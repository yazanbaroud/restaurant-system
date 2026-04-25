import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map } from 'rxjs';

import { OrderStatus, PaymentBreakdown, ReservationStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { OrderCardComponent } from '../../shared/components/order-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ReservationCardComponent } from '../../shared/components/reservation-card.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    AsyncPipe,
    CurrencyPipe,
    OrderCardComponent,
    PageHeaderComponent,
    ReservationCardComponent,
    StatCardComponent
  ],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול מסעדה"
        title="לוח ניהול מסעדת הכבש"
        subtitle="תמונה תפעולית ועסקית: הכנסות, הזמנות, שולחנות, תשלומים ומנות מובילות."
      />

      @if (dashboard$ | async; as dashboard) {
        <div class="stats-grid">
          <app-stat-card icon="₪" label="הכנסות היום" [value]="dashboard.totalRevenueToday" [currency]="true" accent="gold" />
          <app-stat-card icon="₪" label="הכנסות החודש" [value]="dashboard.totalRevenueThisMonth" [currency]="true" accent="olive" />
          <app-stat-card icon="⏱" label="הזמנות פעילות" [value]="dashboard.activeOrders" accent="burgundy" />
          <app-stat-card icon="◎" label="שולחנות פנויים" [value]="dashboard.availableTables" accent="stone" />
        </div>

        <div class="dashboard-grid">
          <article class="panel">
            <h2>מנות מובילות</h2>
            <div class="rank-list">
              @for (dish of dashboard.topDishes; track dish.menuItemId) {
                <div>
                  <span>{{ dish.name }}</span>
                  <strong>{{ dish.revenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                </div>
              }
            </div>
          </article>
          <article class="panel">
            <h2>תשלומים</h2>
            <div class="bar-list">
              @for (payment of dashboard.paymentBreakdown; track payment.method) {
                <div>
                  <span>{{ paymentMethodLabels[payment.method] }}</span>
                  <strong>{{ payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                  <i [style.width.%]="paymentBarWidth(payment.amount, dashboard.paymentBreakdown)"></i>
                </div>
              }
            </div>
          </article>
          <article class="panel panel--warm">
            <h2>סיכום היום</h2>
            <div class="mini-kpis">
              <span>{{ dashboard.reservationsToday }} הזמנות מקום</span>
              <span>{{ dashboard.pendingReservations }} ממתינות</span>
              <span>{{ dashboard.unpaidOrders }} לא שולמו</span>
              <span>{{ dashboard.completedOrders }} הושלמו</span>
            </div>
          </article>
        </div>
      }

      <div class="two-column">
        <section>
          <h2>הזמנות פעילות</h2>
          <div class="resource-grid">
            @for (order of activeOrders$ | async; track order.id) {
              <app-order-card [order]="order" [detailsLink]="['/admin/orders', order.id]" />
            }
          </div>
        </section>
        <section>
          <h2>בקשות הזמנה ממתינות</h2>
          <div class="resource-grid">
            @for (reservation of pendingReservations$ | async; track reservation.id) {
              <app-reservation-card [reservation]="reservation" />
            }
          </div>
        </section>
      </div>
    </section>
  `
})
export class AdminDashboardPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly dashboard$ = this.data.getDashboardSummary();
  readonly activeOrders$ = this.data
    .getOrders()
    .pipe(map((orders) => orders.filter((order) => [OrderStatus.InSalads, OrderStatus.InMain].includes(order.status))));
  readonly pendingReservations$ = this.data
    .getReservations()
    .pipe(map((reservations) => reservations.filter((reservation) => reservation.status === ReservationStatus.Pending)));
  readonly paymentMethodLabels = paymentMethodLabels;

  paymentBarWidth(amount: number, payments: PaymentBreakdown[]): number {
    const maxAmount = Math.max(0, ...payments.map((payment) => payment.amount));
    if (!maxAmount || amount <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(4, (amount / maxAmount) * 100));
  }
}
