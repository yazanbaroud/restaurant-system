import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { BusinessHour, UpdateBusinessHourInput } from '../models';

@Injectable({ providedIn: 'root' })
export class BusinessHoursService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getBusinessHours(): Observable<BusinessHour[]> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/business-hours`).pipe(
      map((response) => this.normalizeBusinessHours(response))
    );
  }

  getAdminBusinessHours(): Observable<BusinessHour[]> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/admin/business-hours`).pipe(
      map((response) => this.normalizeBusinessHours(response))
    );
  }

  updateBusinessHours(hours: UpdateBusinessHourInput[]): Observable<BusinessHour[]> {
    return this.http.put<unknown>(`${this.apiBaseUrl}/api/admin/business-hours`, {
      hours: hours.map((hour) => ({
        ...hour,
        openTime: hour.isOpen ? this.toApiTime(hour.openTime) : null,
        closeTime: hour.isOpen ? this.toApiTime(hour.closeTime) : null
      }))
    }).pipe(
      map((response) => this.normalizeBusinessHours(response))
    );
  }

  private normalizeBusinessHours(response: unknown): BusinessHour[] {
    const items = Array.isArray(response)
      ? response
      : this.asRecord(response)?.['data'];

    return (Array.isArray(items) ? items : [])
      .map((item) => this.normalizeBusinessHour(item))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  private normalizeBusinessHour(response: unknown): BusinessHour {
    const record = this.asRecord(response) ?? {};

    return {
      id: this.numberValue(record['id']),
      dayOfWeek: this.numberValue(record['dayOfWeek']),
      isOpen: this.booleanValue(record['isOpen'], true),
      openTime: this.toInputTime(record['openTime']),
      closeTime: this.toInputTime(record['closeTime'])
    };
  }

  private toInputTime(value: unknown): string | null {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
      return null;
    }

    return raw.slice(0, 5);
  }

  private toApiTime(value: string | null): string | null {
    const raw = value?.trim();
    if (!raw) {
      return null;
    }

    return raw.length === 5 ? `${raw}:00` : raw;
  }

  private numberValue(value: unknown, fallback = 0): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  private booleanValue(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  }
}
