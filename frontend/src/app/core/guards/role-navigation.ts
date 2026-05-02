import { UserRole } from '../models';

export function defaultRouteForRole(role: UserRole): string {
  if (role === UserRole.Admin) {
    return '/admin';
  }

  if (role === UserRole.Waiter) {
    return '/waiter';
  }

  if (role === UserRole.Kitchen) {
    return '/kitchen';
  }

  if (role === UserRole.Salad) {
    return '/salad';
  }

  return '/';
}

export function canUseReturnUrlForRole(role: UserRole, returnUrl: string | null): boolean {
  const path = pathFromReturnUrl(returnUrl);
  if (!path) {
    return false;
  }

  if (isRouteSection(path, '/account')) {
    return true;
  }

  if (role === UserRole.Admin) {
    return isRouteSection(path, '/admin') ||
      isRouteSection(path, '/waiter') ||
      isRouteSection(path, '/salad') ||
      isRouteSection(path, '/kitchen');
  }

  if (role === UserRole.Waiter) {
    return path === '/waiter' ||
      isRouteSection(path, '/waiter/create-order') ||
      isRouteSection(path, '/waiter/orders');
  }

  if (role === UserRole.Kitchen) {
    return isRouteSection(path, '/kitchen');
  }

  if (role === UserRole.Salad) {
    return isRouteSection(path, '/salad');
  }

  return path === '/' ||
    isRouteSection(path, '/menu') ||
    isRouteSection(path, '/reservation');
}

function pathFromReturnUrl(returnUrl: string | null): string | null {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return null;
  }

  return returnUrl.split(/[?#]/)[0];
}

function isRouteSection(path: string, section: string): boolean {
  return path === section || path.startsWith(`${section}/`);
}
