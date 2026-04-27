import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map, switchMap } from 'rxjs';

import {
  DashboardSummary,
  Order,
  OrderStatus,
  PaymentBreakdown,
  Reservation,
  ReservationStatus,
  ReportsSummary
} from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { OrderCardComponent } from '../../shared/components/order-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ReservationCardComponent } from '../../shared/components/reservation-card.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

interface DashboardDateRange {
  fromDate: string;
  toDate: string;
}

interface DashboardViewModel {
  dashboard: DashboardSummary;
  reports: ReportsSummary;
  orders: Order[];
  reservations: Reservation[];
}

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
    <section class="page-surface admin-dashboard">
      <app-page-header
        eyebrow="ניהול מסעדה"
        title="לוח ניהול מסעדת הכבש"
        subtitle="תמונה תפעולית ועסקית: הכנסות, הזמנות, תשלומים, הזמנות מקום ומנות מובילות."
      />

      @if (vm$ | async; as vm) {
        <div class="panel dashboard-toolbar">
          <div class="dashboard-toolbar__filters">
            <label>
              מתאריך
              <input
                #dashboardFrom
                type="date"
                [value]="selectedFromDate"
                (change)="setFromDate(dashboardFrom.value)"
              />
            </label>
            <label>
              עד תאריך
              <input
                #dashboardTo
                type="date"
                [value]="selectedToDate"
                (change)="setToDate(dashboardTo.value)"
              />
            </label>
          </div>
          <div class="dashboard-toolbar__summary">
            <span>תקופה: {{ selectedFromDate }} - {{ selectedToDate }}</span>
            <button type="button" class="btn btn-small btn-ghost" (click)="resetFilters()">איפוס סינון</button>
          </div>
        </div>

        <div class="stats-grid dashboard-kpis">
          <app-stat-card icon="₪" label="הכנסות היום" [value]="vm.dashboard.totalRevenueToday" [currency]="true" accent="gold" />
          <app-stat-card icon="₪" label="הכנסות החודש" [value]="vm.dashboard.totalRevenueThisMonth" [currency]="true" accent="olive" />
          <app-stat-card icon="#" label="הזמנות פעילות" [value]="vm.dashboard.activeOrders" accent="burgundy" />
          <app-stat-card icon="✓" label="הזמנות שהושלמו" [value]="vm.dashboard.completedOrders" accent="olive" />
          <app-stat-card icon="!" label="הזמנות שלא שולמו" [value]="vm.dashboard.unpaidOrders" accent="stone" />
          <app-stat-card icon="R" label="הזמנות מקום להיום" [value]="vm.dashboard.reservationsToday" accent="gold" />
        </div>

        <div class="dashboard-overview-grid">
          <article class="panel dashboard-hero-card">
            <p class="eyebrow">סקירת תקופה</p>
            <h2>{{ vm.reports.sales.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</h2>
            <div class="dashboard-metric-row">
              <span>{{ vm.reports.sales.ordersCount }} הזמנות</span>
              <span>{{ vm.reports.sales.itemsSold }} מנות</span>
              <span>ממוצע {{ vm.reports.sales.averageOrderValue | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
            </div>
          </article>

          <article class="panel">
            <div class="inline-between dashboard-section-title">
              <h2>תשלומים בתקופה</h2>
              <strong>{{ paymentTotal(vm.reports.paymentBreakdown) | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </div>
            <div class="bar-list">
              @for (payment of vm.reports.paymentBreakdown; track payment.method) {
                <div>
                  <span>{{ paymentMethodLabels[payment.method] }}</span>
                  <strong>{{ payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                  <i [style.width.%]="barWidth(payment.amount, maxPaymentAmount(vm.reports.paymentBreakdown))"></i>
                </div>
              } @empty {
                <p class="muted">אין תשלומים להצגה בתקופה שנבחרה.</p>
              }
            </div>
          </article>

          <article class="panel">
            <div class="inline-between dashboard-section-title">
              <h2>הזמנות מקום</h2>
              <strong>{{ reservationsTotal(vm.reports) }}</strong>
            </div>
            <div class="dashboard-status-grid">
              <span>ממתינות <strong>{{ vm.reports.reservationsSummary.pendingReservations }}</strong></span>
              <span>מאושרות <strong>{{ vm.reports.reservationsSummary.approvedReservations }}</strong></span>
              <span>נדחו <strong>{{ vm.reports.reservationsSummary.rejectedReservations }}</strong></span>
              <span>לא הגיע <strong>{{ vm.reports.reservationsSummary.noShowReservations }}</strong></span>
            </div>
          </article>
        </div>

        <div class="dashboard-grid dashboard-grid--wide">
          <article class="panel">
            <h2>מנות מובילות</h2>
            <div class="bar-list">
              @for (dish of vm.reports.topDishes.slice(0, 5); track dish.menuItemId) {
                <div>
                  <span>{{ dish.name }}</span>
                  <strong>{{ dish.quantity }} מנות</strong>
                  <i [style.width.%]="barWidth(dish.quantity, maxDishQuantity(vm.reports.topDishes))"></i>
                </div>
              } @empty {
                <p class="muted">אין נתוני מנות להצגה.</p>
              }
            </div>
          </article>

          <article class="panel">
            <h2>שעות עומס</h2>
            <div class="bar-list">
              @for (hour of vm.reports.peakHours.slice(0, 6); track hour.hour) {
                <div>
                  <span>{{ hour.hour }}</span>
                  <strong>{{ hour.ordersCount }} הזמנות</strong>
                  <i [style.width.%]="barWidth(hour.ordersCount, maxPeakOrders(vm.reports.peakHours))"></i>
                </div>
              } @empty {
                <p class="muted">אין נתוני עומס להצגה.</p>
              }
            </div>
          </article>
        </div>

        <div class="two-column dashboard-lists">
          <section>
            <div class="inline-between dashboard-section-title">
              <h2>הזמנות פעילות</h2>
              <span class="muted">{{ activeOrders(vm.orders).length }} פעילות</span>
            </div>
            <div class="resource-grid dashboard-card-grid">
              @for (order of activeOrders(vm.orders).slice(0, 6); track order.id) {
                <app-order-card [order]="order" [detailsLink]="['/admin/orders', order.id]" />
              } @empty {
                <div class="empty-state">
                  <h2>אין הזמנות פעילות בתקופה שנבחרה</h2>
                </div>
              }
            </div>
          </section>

          <section>
            <div class="inline-between dashboard-section-title">
              <h2>בקשות הזמנה ממתינות</h2>
              <span class="muted">{{ pendingReservations(vm.reservations).length }} ממתינות</span>
            </div>
            <div class="resource-grid dashboard-card-grid">
              @for (reservation of pendingReservations(vm.reservations).slice(0, 6); track reservation.id) {
                <app-reservation-card [reservation]="reservation" />
              } @empty {
                <div class="empty-state">
                  <h2>אין בקשות ממתינות בתקופה שנבחרה</h2>
                </div>
              }
            </div>
          </section>
        </div>
      } @else {
        <div class="empty-state">
          <h2>טוען נתוני ניהול...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .admin-dashboard {
      display: grid;
      gap: 1rem;
    }

    .dashboard-toolbar {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) auto;
      gap: 1rem;
      align-items: end;
    }

    .dashboard-toolbar__filters,
    .dashboard-toolbar__summary,
    .dashboard-metric-row {
      display: flex;
      align-items: end;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .dashboard-toolbar__filters label {
      min-width: 170px;
    }

    .dashboard-toolbar__summary {
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 850;
    }

    .dashboard-kpis {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      margin-bottom: 0;
    }

    .dashboard-overview-grid {
      display: grid;
      grid-template-columns: minmax(280px, 1.1fr) repeat(2, minmax(260px, 0.95fr));
      gap: 18px;
    }

    .dashboard-hero-card {
      background: linear-gradient(135deg, rgba(31, 21, 17, 0.96), rgba(61, 37, 25, 0.92));
      color: var(--ivory);
    }

    .dashboard-hero-card h2 {
      margin: 0 0 1rem;
      color: var(--ivory);
      font-size: 2.4rem;
    }

    .dashboard-hero-card .eyebrow,
    .dashboard-hero-card span {
      color: rgba(255, 248, 237, 0.82);
    }

    .dashboard-metric-row span,
    .dashboard-status-grid span {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      min-height: 38px;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.56);
      font-weight: 850;
    }

    .dashboard-status-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
    }

    .dashboard-section-title {
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.8rem;
    }

    .dashboard-section-title h2 {
      margin: 0;
    }

    .dashboard-grid--wide {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .dashboard-lists {
      align-items: start;
    }

    .dashboard-card-grid {
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
    }

    @media (max-width: 1120px) {
      .dashboard-kpis {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .dashboard-overview-grid,
      .dashboard-grid--wide {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .dashboard-toolbar {
        grid-template-columns: 1fr;
      }

      .dashboard-toolbar__summary {
        justify-content: flex-start;
      }

      .dashboard-toolbar__filters label,
      .dashboard-toolbar__summary .btn {
        flex: 1 1 160px;
      }

      .dashboard-kpis,
      .dashboard-status-grid,
      .dashboard-card-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AdminDashboardPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly defaultRange = this.currentMonthRange();
  private readonly dateRange$ = new BehaviorSubject<DashboardDateRange>(this.defaultRange);

  readonly paymentMethodLabels = paymentMethodLabels;
  selectedFromDate = this.defaultRange.fromDate;
  selectedToDate = this.defaultRange.toDate;

  readonly vm$ = combineLatest({
    dashboard: this.data.getDashboardSummary(),
    reports: this.dateRange$.pipe(switchMap(({ fromDate, toDate }) => this.data.getReportsSummary(fromDate, toDate))),
    orders: this.dateRange$.pipe(switchMap(({ fromDate, toDate }) => this.data.getOrders(fromDate, toDate))),
    reservations: this.dateRange$.pipe(switchMap(({ fromDate, toDate }) => this.data.getReservations(fromDate, toDate)))
  }).pipe(
    map((vm) => vm as DashboardViewModel)
  );

  setFromDate(date: string): void {
    this.selectedFromDate = date;
    this.reloadDateRange();
  }

  setToDate(date: string): void {
    this.selectedToDate = date;
    this.reloadDateRange();
  }

  resetFilters(): void {
    const range = this.currentMonthRange();
    this.selectedFromDate = range.fromDate;
    this.selectedToDate = range.toDate;
    this.dateRange$.next(range);
  }

  activeOrders(orders: Order[]): Order[] {
    return orders.filter((order) => [OrderStatus.InSalads, OrderStatus.InMain].includes(order.status));
  }

  pendingReservations(reservations: Reservation[]): Reservation[] {
    return reservations.filter((reservation) => reservation.status === ReservationStatus.Pending);
  }

  paymentTotal(payments: PaymentBreakdown[]): number {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  reservationsTotal(reports: ReportsSummary): number {
    const summary = reports.reservationsSummary;
    return summary.pendingReservations +
      summary.approvedReservations +
      summary.rejectedReservations +
      summary.cancelledReservations +
      summary.arrivedReservations +
      summary.noShowReservations;
  }

  barWidth(value: number, max: number): number {
    if (!max || value <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(4, (value / max) * 100));
  }

  maxPaymentAmount(payments: PaymentBreakdown[]): number {
    return Math.max(0, ...payments.map((payment) => payment.amount));
  }

  maxDishQuantity(dishes: { quantity: number }[]): number {
    return Math.max(0, ...dishes.map((dish) => dish.quantity));
  }

  maxPeakOrders(hours: { ordersCount: number }[]): number {
    return Math.max(0, ...hours.map((hour) => hour.ordersCount));
  }

  private reloadDateRange(): void {
    this.dateRange$.next({
      fromDate: this.selectedFromDate,
      toDate: this.selectedToDate
    });
  }

  private currentMonthRange(): DashboardDateRange {
    const now = new Date();
    return {
      fromDate: this.formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      toDate: this.formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    };
  }

  private formatLocalDate(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }
}
