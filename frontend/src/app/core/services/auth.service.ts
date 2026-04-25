import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User, UserRole } from '../models';

export const AUTH_TOKEN_STORAGE_KEY = 'hakeves.jwt';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role?: UserRole;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);

  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly currentRole$ = this.currentUser$.pipe(map((user) => user?.role ?? null));

  constructor() {
    if (this.hasToken()) {
      this.me().pipe(
        catchError(() => {
          this.logout();
          return of(null);
        })
      ).subscribe();
    }
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  }

  hasToken(): boolean {
    return Boolean(this.getToken());
  }

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/api/Auth/login`, credentials).pipe(
      switchMap((response) => this.applyAuthResponse(response))
    );
  }

  register(input: RegisterRequest): Observable<User> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/api/Auth/register`, input).pipe(
      switchMap((response) => this.applyAuthResponse(response))
    );
  }

  me(): Observable<User> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/Auth/me`).pipe(
      map((response) => this.normalizeUser(this.extractUserPayload(response) ?? response)),
      tap((user) => this.currentUserSubject.next(user))
    );
  }

  updateProfile(input: UpdateProfileRequest): Observable<User> {
    return this.http.put<unknown>(`${this.apiBaseUrl}/api/Auth/me`, input).pipe(
      map((response) => this.normalizeUser(this.extractUserPayload(response) ?? response)),
      tap((user) => this.currentUserSubject.next(user))
    );
  }

  changePassword(input: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${this.apiBaseUrl}/api/Auth/me/password`, input);
  }

  logout(): void {
    this.clearToken();
    this.currentUserSubject.next(null);
  }

  private applyAuthResponse(response: unknown): Observable<User> {
    const token = this.extractToken(response);

    if (!token) {
      return throwError(() => new Error('Login response did not include a JWT token.'));
    }

    this.setToken(token);

    const userPayload = this.extractUserPayload(response);
    if (userPayload) {
      const user = this.normalizeUser(userPayload);
      this.currentUserSubject.next(user);
      return of(user);
    }

    return this.me();
  }

  private setToken(token: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    }
  }

  private clearToken(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  }

  private extractToken(value: unknown): string | null {
    const record = this.asRecord(value);
    if (!record) {
      return null;
    }

    for (const key of ['token', 'jwtToken', 'accessToken']) {
      const token = record[key];
      if (typeof token === 'string' && token.trim()) {
        return token;
      }
    }

    return this.extractToken(record['data']);
  }

  private extractUserPayload(value: unknown): unknown | null {
    const record = this.asRecord(value);
    if (!record) {
      return null;
    }

    if (this.asRecord(record['user'])) {
      return record['user'];
    }

    const data = this.asRecord(record['data']);
    if (data?.['user']) {
      return data['user'];
    }

    if ('email' in record || 'role' in record || 'firstName' in record) {
      return record;
    }

    return null;
  }

  private normalizeUser(value: unknown): User {
    const record = this.asRecord(value) ?? {};

    return {
      id: this.numberValue(record['id'] ?? record['userId']),
      firstName: this.stringValue(record['firstName'] ?? record['name']) || 'משתמש',
      lastName: this.stringValue(record['lastName']) || '',
      email: this.stringValue(record['email']),
      phoneNumber: this.stringValue(record['phoneNumber'] ?? record['phone']),
      role: this.normalizeRole(record['role'] ?? record['userRole'])
    };
  }

  private normalizeRole(value: unknown): UserRole {
    if (typeof value === 'number' && this.isKnownRole(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const numericRole = Number(value);
      if (this.isKnownRole(numericRole)) {
        return numericRole;
      }

      const roleName = value.toLowerCase();
      if (roleName === 'admin') {
        return UserRole.Admin;
      }

      if (roleName === 'waiter') {
        return UserRole.Waiter;
      }
    }

    return UserRole.Customer;
  }

  private isKnownRole(value: number): value is UserRole {
    return value === UserRole.Admin || value === UserRole.Waiter || value === UserRole.Customer;
  }

  private numberValue(value: unknown): number {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }
}
