import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const AUTH_RETRY = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const accessToken = auth.getAccessToken();
  const requestWithAuth = shouldAttachAccessToken(request)
    ? addAuthorizationHeader(request, accessToken)
    : request;

  return next(requestWithAuth).pipe(
    catchError((error: unknown) => {
      if (!shouldRefresh(request, error, auth)) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap((token) => {
          const retryRequest = addAuthorizationHeader(
            request.clone({ context: request.context.set(AUTH_RETRY, true) }),
            token
          );
          return next(retryRequest);
        }),
        catchError((refreshError: unknown) => {
          auth.clearSession();
          void router.navigate(['/login'], {
            queryParams: {
              returnUrl: router.url
            }
          });
          return throwError(() => refreshError);
        })
      );
    })
  );
};

function addAuthorizationHeader<T>(request: HttpRequest<T>, token: string | null): HttpRequest<T> {
  if (!token) {
    return request;
  }

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

function shouldRefresh(request: HttpRequest<unknown>, error: unknown, auth: AuthService): boolean {
  return error instanceof HttpErrorResponse &&
    error.status === 401 &&
    !request.context.get(AUTH_RETRY) &&
    !isAuthLifecycleRequest(request) &&
    auth.hasRefreshToken();
}

function shouldAttachAccessToken(request: HttpRequest<unknown>): boolean {
  return !isAuthEndpoint(request, ['login', 'refresh', 'logout']);
}

function isAuthLifecycleRequest(request: HttpRequest<unknown>): boolean {
  return isAuthEndpoint(request, ['login', 'refresh', 'logout']);
}

function isAuthEndpoint(request: HttpRequest<unknown>, actions: string[]): boolean {
  const url = request.url.toLowerCase();
  return actions.some((action) => url.includes(`/api/auth/${action}`));
}
