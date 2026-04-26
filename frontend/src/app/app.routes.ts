import { Routes } from '@angular/router';

import { AdminShellComponent } from './core/layout/admin-shell.component';
import { PublicShellComponent } from './core/layout/public-shell.component';
import { WaiterShellComponent } from './core/layout/waiter-shell.component';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './core/models';
import { LoginPageComponent } from './features/auth/login-page.component';
import { RegisterPageComponent } from './features/auth/register-page.component';
import { AccountPageComponent } from './features/account/account-page.component';
import { AdminDashboardPageComponent } from './features/admin/admin-dashboard-page.component';
import { MenuItemFormPageComponent } from './features/admin/menu-item-form-page.component';
import { MenuManagementPageComponent } from './features/admin/menu-management-page.component';
import { OrdersManagementPageComponent } from './features/admin/orders-management-page.component';
import { PaymentsTrackingPageComponent } from './features/admin/payments-tracking-page.component';
import { ReportsPageComponent } from './features/admin/reports-page.component';
import { ReservationsManagementPageComponent } from './features/admin/reservations-management-page.component';
import { TableFormPageComponent } from './features/admin/table-form-page.component';
import { TablesManagementPageComponent } from './features/admin/tables-management-page.component';
import { UserFormPageComponent } from './features/admin/user-form-page.component';
import { UsersManagementPageComponent } from './features/admin/users-management-page.component';
import { DishDetailsPageComponent } from './features/public/dish-details-page.component';
import { LandingPageComponent } from './features/public/landing-page.component';
import { MenuPageComponent } from './features/public/menu-page.component';
import { ReservationPageComponent } from './features/public/reservation-page.component';
import { ActiveOrdersPageComponent } from './features/waiter/active-orders-page.component';
import { AddPaymentPageComponent } from './features/waiter/add-payment-page.component';
import { CreateOrderPageComponent } from './features/waiter/create-order-page.component';
import { OrderDetailsPageComponent } from './features/waiter/order-details-page.component';
import { WaiterReservationsPageComponent } from './features/waiter/waiter-reservations-page.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicShellComponent,
    children: [
      { path: '', component: LandingPageComponent },
      { path: 'menu', component: MenuPageComponent },
      { path: 'menu/:id', component: DishDetailsPageComponent },
      { path: 'reservation', component: ReservationPageComponent },
      { path: 'account', component: AccountPageComponent, canActivate: [roleGuard] },
      { path: 'login', component: LoginPageComponent },
      { path: 'register', component: RegisterPageComponent }
    ]
  },
  {
    path: 'waiter',
    component: WaiterShellComponent,
    canActivate: [roleGuard],
    data: { roles: [UserRole.Waiter] },
    children: [
      { path: '', component: ActiveOrdersPageComponent },
      { path: 'create-order', component: CreateOrderPageComponent },
      { path: 'orders/:id', component: OrderDetailsPageComponent },
      { path: 'orders/:id/payment', component: AddPaymentPageComponent },
      { path: 'reservations', component: WaiterReservationsPageComponent }
    ]
  },
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [roleGuard],
    data: { roles: [UserRole.Admin] },
    children: [
      { path: '', component: AdminDashboardPageComponent },
      { path: 'orders', component: OrdersManagementPageComponent },
      { path: 'orders/new', component: CreateOrderPageComponent },
      { path: 'orders/:id', component: OrderDetailsPageComponent },
      { path: 'orders/:id/payment', component: AddPaymentPageComponent },
      { path: 'reservations', component: ReservationsManagementPageComponent },
      { path: 'menu/new', component: MenuItemFormPageComponent },
      { path: 'menu/:id/edit', component: MenuItemFormPageComponent },
      { path: 'menu', component: MenuManagementPageComponent },
      { path: 'tables/new', component: TableFormPageComponent },
      { path: 'tables/:id/edit', component: TableFormPageComponent },
      { path: 'tables', component: TablesManagementPageComponent },
      { path: 'users/new', component: UserFormPageComponent },
      { path: 'users/:id/edit', component: UserFormPageComponent },
      { path: 'users', component: UsersManagementPageComponent },
      { path: 'payments', component: PaymentsTrackingPageComponent },
      { path: 'reports', component: ReportsPageComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
