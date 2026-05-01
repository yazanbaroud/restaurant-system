import { Routes } from '@angular/router';

import { AdminShellComponent } from './core/layout/admin-shell.component';
import { PublicShellComponent } from './core/layout/public-shell.component';
import { WaiterShellComponent } from './core/layout/waiter-shell.component';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './core/models';

export const routes: Routes = [
  {
    path: '',
    component: PublicShellComponent,
    children: [
      { path: '', loadComponent: () => import('./features/public/landing-page.component').then((m) => m.LandingPageComponent) },
      { path: 'menu', loadComponent: () => import('./features/public/menu-page.component').then((m) => m.MenuPageComponent) },
      { path: 'menu/:id', loadComponent: () => import('./features/public/dish-details-page.component').then((m) => m.DishDetailsPageComponent) },
      { path: 'reservation', loadComponent: () => import('./features/public/reservation-page.component').then((m) => m.ReservationPageComponent) },
      { path: 'account', loadComponent: () => import('./features/account/account-page.component').then((m) => m.AccountPageComponent), canActivate: [roleGuard] },
      { path: 'cart', loadComponent: () => import('./features/customer/cart-page.component').then((m) => m.CartPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Customer] } },
      { path: 'orders', loadComponent: () => import('./features/customer/customer-orders-page.component').then((m) => m.CustomerOrdersPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Customer] } },
      { path: 'orders/:id', loadComponent: () => import('./features/customer/customer-order-details-page.component').then((m) => m.CustomerOrderDetailsPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Customer] } },
      { path: 'reservations', loadComponent: () => import('./features/customer/customer-reservations-page.component').then((m) => m.CustomerReservationsPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Customer] } },
      { path: 'reservations/:id', loadComponent: () => import('./features/customer/customer-reservation-details-page.component').then((m) => m.CustomerReservationDetailsPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Customer] } },
      { path: 'login', loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent) }
    ]
  },
  {
    path: 'waiter',
    component: WaiterShellComponent,
    canActivate: [roleGuard],
    data: { roles: [UserRole.Admin, UserRole.Waiter, UserRole.Kitchen, UserRole.Salad] },
    children: [
      { path: '', loadComponent: () => import('./features/waiter/tables-page.component').then((m) => m.TablesPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Admin, UserRole.Waiter] } },
      { path: 'salads', loadComponent: () => import('./features/waiter/salad-screen-page.component').then((m) => m.SaladScreenPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Admin, UserRole.Waiter, UserRole.Salad] } },
      { path: 'kitchen', loadComponent: () => import('./features/waiter/kitchen-page.component').then((m) => m.KitchenPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Admin, UserRole.Waiter, UserRole.Kitchen] } },
      { path: 'create-order', loadComponent: () => import('./features/waiter/create-order-page.component').then((m) => m.CreateOrderPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Admin, UserRole.Waiter] } },
      { path: 'orders/:id', loadComponent: () => import('./features/waiter/order-details-page.component').then((m) => m.OrderDetailsPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Admin, UserRole.Waiter] } },
      { path: 'orders/:id/payment', loadComponent: () => import('./features/waiter/add-payment-page.component').then((m) => m.AddPaymentPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Admin, UserRole.Waiter] } },
      { path: 'reservations', loadComponent: () => import('./features/waiter/waiter-reservations-page.component').then((m) => m.WaiterReservationsPageComponent), canActivate: [roleGuard], data: { roles: [UserRole.Admin, UserRole.Waiter] } }
    ]
  },
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [roleGuard],
    data: { roles: [UserRole.Admin] },
    children: [
      { path: '', loadComponent: () => import('./features/admin/admin-dashboard-page.component').then((m) => m.AdminDashboardPageComponent) },
      { path: 'orders', loadComponent: () => import('./features/admin/orders-management-page.component').then((m) => m.OrdersManagementPageComponent) },
      { path: 'orders/new', loadComponent: () => import('./features/waiter/create-order-page.component').then((m) => m.CreateOrderPageComponent) },
      { path: 'orders/:id', loadComponent: () => import('./features/waiter/order-details-page.component').then((m) => m.OrderDetailsPageComponent) },
      { path: 'orders/:id/payment', loadComponent: () => import('./features/waiter/add-payment-page.component').then((m) => m.AddPaymentPageComponent) },
      { path: 'reservations', loadComponent: () => import('./features/admin/reservations-management-page.component').then((m) => m.ReservationsManagementPageComponent) },
      { path: 'menu/new', loadComponent: () => import('./features/admin/menu-item-form-page.component').then((m) => m.MenuItemFormPageComponent) },
      { path: 'menu/:id/edit', loadComponent: () => import('./features/admin/menu-item-form-page.component').then((m) => m.MenuItemFormPageComponent) },
      { path: 'menu', loadComponent: () => import('./features/admin/menu-management-page.component').then((m) => m.MenuManagementPageComponent) },
      { path: 'tables/new', loadComponent: () => import('./features/admin/table-form-page.component').then((m) => m.TableFormPageComponent) },
      { path: 'tables/:id/edit', loadComponent: () => import('./features/admin/table-form-page.component').then((m) => m.TableFormPageComponent) },
      { path: 'tables', loadComponent: () => import('./features/admin/tables-management-page.component').then((m) => m.TablesManagementPageComponent) },
      { path: 'users/new', loadComponent: () => import('./features/admin/user-form-page.component').then((m) => m.UserFormPageComponent) },
      { path: 'users/:id/edit', loadComponent: () => import('./features/admin/user-form-page.component').then((m) => m.UserFormPageComponent) },
      { path: 'users', loadComponent: () => import('./features/admin/users-management-page.component').then((m) => m.UsersManagementPageComponent) },
      { path: 'payments', loadComponent: () => import('./features/admin/payments-tracking-page.component').then((m) => m.PaymentsTrackingPageComponent) },
      { path: 'business-hours', loadComponent: () => import('./features/admin/business-hours-page.component').then((m) => m.BusinessHoursPageComponent) },
      { path: 'reports', loadComponent: () => import('./features/admin/reports-page.component').then((m) => m.ReportsPageComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];
