import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Reservation, ReservationStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class CustomerReservationsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getReservations(): Observable<Reservation[]> {
    return this.http.get<unknown[]>(`${this.apiBaseUrl}/api/customer/reservations`).pipe(
      map((response) => response.map((reservation) => this.normalizeReservation(reservation)))
    );
  }

  getReservation(id: number): Observable<Reservation> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/customer/reservations/${id}`).pipe(
      map((response) => this.normalizeReservation(response))
    );
  }

  cancelReservation(id: number): Observable<Reservation> {
    return this.http.put<unknown>(`${this.apiBaseUrl}/api/customer/reservations/${id}/cancel`, {}).pipe(
      map((response) => this.normalizeReservation(response))
    );
  }

  private normalizeReservation(value: unknown): Reservation {
    const record = this.asRecord(value) ?? {};

    return {
      id: this.numberValue(record['id']),
      customerFirstName: this.stringValue(record['customerFirstName'] ?? record['firstName']),
      customerLastName: this.stringValue(record['customerLastName'] ?? record['lastName']),
      phoneNumber: this.stringValue(record['phoneNumber'] ?? record['phone']),
      reservationDate: this.stringValue(record['reservationDate'] ?? record['date']),
      reservationTime: this.stringValue(record['reservationTime'] ?? record['time']),
      durationMinutes: this.numberValue(record['durationMinutes'], 120),
      guestCount: this.numberValue(record['guestCount'] ?? record['guestsCount']),
      notes: this.stringValue(record['notes'] ?? record['customerNotes']),
      tableId: this.nullableNumberValue(record['tableId']),
      tableName: this.stringValue(record['tableName']),
      restaurantNotes: this.stringValue(record['restaurantNotes']),
      status: this.normalizeReservationStatus(record['status']),
      createdAt: this.stringValue(record['createdAt'] ?? record['createdOn'])
    };
  }

  private normalizeReservationStatus(value: unknown): ReservationStatus {
    const numericValue = Number(value);
    return Object.values(ReservationStatus).includes(numericValue as ReservationStatus)
      ? numericValue as ReservationStatus
      : ReservationStatus.Pending;
  }

  private numberValue(value: unknown, fallback = 0): number {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  private nullableNumberValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  }
}
