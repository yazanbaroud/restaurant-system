import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly onlineSubject = new BehaviorSubject<boolean>(this.readNavigatorOnline());

  readonly online$ = this.onlineSubject.asObservable();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onlineSubject.next(true));
      window.addEventListener('offline', () => this.onlineSubject.next(false));
    }
  }

  get isOnlineSnapshot(): boolean {
    return this.onlineSubject.value;
  }

  private readNavigatorOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }
}
