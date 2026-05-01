import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { User, UserRole } from '../models';

export const AUTH_TOKEN_STORAGE_KEY = 'hakeves.jwt';
export const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'hakeves.refreshToken';
export const AUTH_TOKEN_EXPIRES_AT_STORAGE_KEY = 'hakeves.jwt.expiresAtUtc';

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
  private refreshRequest$: Observable<string> | null = null;

  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly currentRole$ = this.currentUser$.pipe(map((user) => user?.role ?? null));

  constructor() {
    if (this.hasToken()) {
      this.me().pipe(
        catchError(() => {
          this.clearSession();
          return of(null);
        })
      ).subscribe();
    }
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.getAccessToken();
  }

  getAccessToken(): string | null {
    return this.readStorage(AUTH_TOKEN_STORAGE_KEY);
  }

  getRefreshToken(): string | null {
    return this.readStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY);
  }

  hasRefreshToken(): boolean {
    return Boolean(this.getRefreshToken());
  }

  getAccessTokenExpiresAtUtc(): string | null {
    return this.readStorage(AUTH_TOKEN_EXPIRES_AT_STORAGE_KEY);
  }

  hasToken(): boolean {
    return Boolean(this.getAccessToken() || this.getRefreshToken());
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

  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token is available.'));
    }

    this.refreshRequest$ = this.http.post<unknown>(`${this.apiBaseUrl}/api/Auth/refresh`, { refreshToken }).pipe(
      switchMap((response) => this.applyAuthResponse(response)),
      map(() => {
        const accessToken = this.getAccessToken();
        if (!accessToken) {
          throw new Error('Refresh response did not include an access token.');
        }

        return accessToken;
      }),
      finalize(() => {
        this.refreshRequest$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.refreshRequest$;
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
    return this.http.put<void>(`${this.apiBaseUrl}/api/Auth/me/password`, input).pipe(
      tap(() => this.clearSession())
    );
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      return;
    }

    this.http.post<void>(`${this.apiBaseUrl}/api/Auth/logout`, { refreshToken }).pipe(
      catchError(() => of(void 0)),
      finalize(() => this.clearSession())
    ).subscribe();
  }

  clearSession(): void {
    this.clearStoredAuth();
    this.currentUserSubject.next(null);
  }

  private applyAuthResponse(response: unknown): Observable<User> {
    const accessToken = this.extractString(response, ['token', 'jwtToken', 'accessToken']);
    const refreshToken = this.extractString(response, ['refreshToken']);
    const expiresAtUtc = this.extractString(response, ['expiresAtUtc', 'expiresAt', 'accessTokenExpiresAtUtc']);

    if (!accessToken) {
      return throwError(() => new Error('Login response did not include a JWT token.'));
    }

    this.setAuthTokens(accessToken, refreshToken, expiresAtUtc);

    const userPayload = this.extractUserPayload(response);
    if (userPayload) {
      const user = this.normalizeUser(userPayload);
      this.currentUserSubject.next(user);
      return of(user);
    }

    return this.me();
  }

  private setAuthTokens(accessToken: string, refreshToken: string | null, expiresAtUtc: string | null): void {
    this.writeStorage(AUTH_TOKEN_STORAGE_KEY, accessToken);

    if (refreshToken) {
      this.writeStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    }

    if (expiresAtUtc) {
      this.writeStorage(AUTH_TOKEN_EXPIRES_AT_STORAGE_KEY, expiresAtUtc);
    } else {
      this.removeStorage(AUTH_TOKEN_EXPIRES_AT_STORAGE_KEY);
    }
  }

  private clearStoredAuth(): void {
    this.removeStorage(AUTH_TOKEN_STORAGE_KEY);
    this.removeStorage(AUTH_REFRESH_TOKEN_STORAGE_KEY);
    this.removeStorage(AUTH_TOKEN_EXPIRES_AT_STORAGE_KEY);
  }

  private extractString(value: unknown, keys: string[]): string | null {
    const record = this.asRecord(value);
    if (!record) {
      return null;
    }

    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }

    return this.extractString(record['data'], keys);
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
      firstName: this.stringValue(record['firstName'] ?? record['name']) || 'User',
      lastName: this.stringValue(record['lastName']) || '',
      email: this.stringValue(record['email']),
      phoneNumber: this.stringValue(record['phoneNumber'] ?? record['phone']),
      role: this.normalizeRole(record['role'] ?? record['userRole']),
      isActive: this.booleanValue(record['isActive'], true)
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

      const roleName = value.toLowerCase().replace(/[\s_-]/g, '');
      if (roleName === 'admin') {
        return UserRole.Admin;
      }

      if (roleName === 'waiter') {
        return UserRole.Waiter;
      }

      if (roleName === 'kitchen') {
        return UserRole.Kitchen;
      }

      if (roleName === 'salad' || roleName === 'salads') {
        return UserRole.Salad;
      }
    }

    return UserRole.Customer;
  }

  private isKnownRole(value: number): value is UserRole {
    return value === UserRole.Admin ||
      value === UserRole.Waiter ||
      value === UserRole.Customer ||
      value === UserRole.Kitchen ||
      value === UserRole.Salad;
  }

  private numberValue(value: unknown): number {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private booleanValue(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private readStorage(key: string): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem(key);
  }

  private writeStorage(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  private removeStorage(key: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }
}
