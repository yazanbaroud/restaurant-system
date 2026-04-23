import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { UserRole } from '../models';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data['roles'] as UserRole[] | undefined;

  if (!roles?.length || roles.includes(auth.currentUser.role)) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { role: roles[0] }
  });
};
