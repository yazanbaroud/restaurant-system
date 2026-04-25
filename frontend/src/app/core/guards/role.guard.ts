import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { User, UserRole } from '../models';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data['roles'] as UserRole[] | undefined;

  if (!auth.hasToken()) {
    return loginRedirect(router, state.url, roles);
  }

  const currentUser = auth.currentUser;
  if (currentUser) {
    return authorizeUser(currentUser, roles, router);
  }

  return auth.me().pipe(
    map((user) => authorizeUser(user, roles, router)),
    catchError(() => {
      auth.logout();
      return of(loginRedirect(router, state.url, roles));
    })
  );
};

function authorizeUser(
  user: User,
  roles: UserRole[] | undefined,
  router: Router
): true | UrlTree {
  if (!roles?.length || roles.includes(user.role)) {
    return true;
  }

  return router.createUrlTree([defaultRouteForRole(user.role)]);
}

function loginRedirect(router: Router, returnUrl: string, roles: UserRole[] | undefined): UrlTree {
  return router.createUrlTree(['/login'], {
    queryParams: {
      returnUrl,
      role: roles?.[0] ?? null
    }
  });
}

function defaultRouteForRole(role: UserRole): string {
  if (role === UserRole.Admin) {
    return '/admin';
  }

  if (role === UserRole.Waiter) {
    return '/waiter';
  }

  return '/';
}
