import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

import { NetworkStatusService } from '../services/network-status.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const offlineInterceptor: HttpInterceptorFn = (request, next) => {
  const network = inject(NetworkStatusService);

  if (!network.isOnlineSnapshot && !SAFE_METHODS.has(request.method.toUpperCase())) {
    return throwError(() => new HttpErrorResponse({
      status: 0,
      statusText: 'לא מקוון',
      url: request.url,
      error: {
        title: 'אין חיבור לאינטרנט'
      }
    }));
  }

  return next(request);
};
