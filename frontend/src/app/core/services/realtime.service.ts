import { Injectable, inject } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type RealtimeEventName =
  | 'orderCreated'
  | 'orderUpdated'
  | 'orderStatusUpdated'
  | 'paymentAdded'
  | 'reservationCreated'
  | 'reservationStatusUpdated';

export interface RealtimeEvent {
  name: RealtimeEventName;
  payload: unknown;
}

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

const RESTAURANT_EVENTS: RealtimeEventName[] = [
  'orderCreated',
  'orderUpdated',
  'orderStatusUpdated',
  'paymentAdded',
  'reservationCreated',
  'reservationStatusUpdated'
];

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly eventsSubject = new Subject<RealtimeEvent>();
  private readonly connectionStateSubject = new BehaviorSubject<RealtimeConnectionState>('disconnected');
  private connection: HubConnection | null = null;

  readonly events$ = this.eventsSubject.asObservable();
  readonly connectionState$ = this.connectionStateSubject.asObservable();

  constructor() {
    this.auth.currentUser$.subscribe((user) => {
      if (user) {
        void this.connect();
      } else {
        void this.disconnect();
      }
    });
  }

  async connect(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected || this.connection?.state === HubConnectionState.Connecting) {
      return;
    }

    this.connection = this.createConnection();
    this.connectionStateSubject.next('connecting');

    try {
      await this.connection.start();
      this.connectionStateSubject.next('connected');
    } catch {
      this.connectionStateSubject.next('disconnected');
      await this.safeStopConnection();
    }
  }

  async disconnect(): Promise<void> {
    await this.safeStopConnection();
    this.connectionStateSubject.next('disconnected');
  }

  private createConnection(): HubConnection {
    const connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl(), {
        accessTokenFactory: () => this.auth.getToken() ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    for (const eventName of RESTAURANT_EVENTS) {
      connection.on(eventName, (payload: unknown) => {
        this.eventsSubject.next({ name: eventName, payload });
      });
    }

    connection.onreconnecting(() => this.connectionStateSubject.next('reconnecting'));
    connection.onreconnected(() => this.connectionStateSubject.next('connected'));
    connection.onclose(() => this.connectionStateSubject.next('disconnected'));

    return connection;
  }

  private async safeStopConnection(): Promise<void> {
    const currentConnection = this.connection;
    this.connection = null;

    if (!currentConnection || currentConnection.state === HubConnectionState.Disconnected) {
      return;
    }

    try {
      await currentConnection.stop();
    } catch {
      // Realtime is an enhancement; failed disconnects should not affect app flows.
    }
  }

  private hubUrl(): string {
    const baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
    return `${baseUrl}/hubs/restaurant`;
  }
}
