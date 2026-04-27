import { AsyncPipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BehaviorSubject, switchMap } from 'rxjs';

import {
  PaymentBreakdown,
  PaymentMethod,
  PeakHourReport,
  ReportsSummary,
  ReservationsReportSummary,
  TableOccupancyReport,
  TopDish,
  WaiterPerformanceReport
} from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

interface ReportsDateRange {
  fromDate: string;
  toDate: string;
}

type ReservationLegendKey = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'arrived' | 'noShow';
type TableOccupancyKey = 'occupied' | 'available' | 'reserved';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DecimalPipe, PageHeaderComponent],
  template: `
    <section class="page-surface reports-page">
      <app-page-header
        eyebrow="דוחות"
        title="תובנות למסעדה"
        subtitle="ניתוח ביצועים לפי תקופה: הכנסות, מכירות, מנות, תשלומים, שעות עומס, מלצרים, הזמנות מקום ותפוסת שולחנות."
      />

      @if (reports$ | async; as reports) {
        <div class="panel reports-toolbar">
          <div class="reports-toolbar__filters">
            <label>
              מתאריך
              <input #reportsFrom type="date" [value]="selectedFromDate" (change)="setFromDate(reportsFrom.value)" />
            </label>
            <label>
              עד תאריך
              <input #reportsTo type="date" [value]="selectedToDate" (change)="setToDate(reportsTo.value)" />
            </label>
          </div>

          <div class="reports-toolbar__summary">
            <span>{{ selectedFromDate }} - {{ selectedToDate }}</span>
            <button type="button" class="btn btn-small btn-ghost" (click)="resetFilters()">איפוס סינון</button>
          </div>
        </div>

        <div class="reports-kpi-grid">
          <article class="panel report-kpi report-kpi--primary">
            <span>הכנסות בתקופה</span>
            <strong>{{ reports.sales.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
          </article>
          <article class="panel report-kpi">
            <span>הזמנות</span>
            <strong>{{ reports.sales.ordersCount }}</strong>
          </article>
          <article class="panel report-kpi">
            <span>מנות שנמכרו</span>
            <strong>{{ reports.sales.itemsSold }}</strong>
          </article>
          <article class="panel report-kpi">
            <span>ממוצע להזמנה</span>
            <strong>{{ reports.sales.averageOrderValue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
          </article>
        </div>

        <div class="reports-analytics-grid">
          <article class="panel report-card report-card--wide">
            <div class="inline-between report-card__header">
              <h2>הכנסות לפי תקופה</h2>
              <span class="muted">השוואה מהירה</span>
            </div>
            <div class="period-chart">
              <div>
                <span>יומי</span>
                <i [style.height.%]="barWidth(reports.daily.totalRevenue, maxPeriodRevenue(reports))"></i>
                <strong>{{ reports.daily.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>
              <div>
                <span>שבועי</span>
                <i [style.height.%]="barWidth(reports.weekly.totalRevenue, maxPeriodRevenue(reports))"></i>
                <strong>{{ reports.weekly.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>
              <div>
                <span>חודשי</span>
                <i [style.height.%]="barWidth(reports.monthly.totalRevenue, maxPeriodRevenue(reports))"></i>
                <strong>{{ reports.monthly.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>
              <div>
                <span>שנתי</span>
                <i [style.height.%]="barWidth(reports.yearly.totalRevenue, maxPeriodRevenue(reports))"></i>
                <strong>{{ reports.yearly.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>
            </div>
          </article>

          <article class="panel report-card">
            <div class="inline-between report-card__header">
              <h2>אמצעי תשלום</h2>
              <strong>{{ paymentTotal(reports.paymentBreakdown) | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </div>
            <div class="donut-layout">
              <div class="donut" [style.background]="paymentDonutStyle(reports.paymentBreakdown)">
                <span>{{ paymentTotal(reports.paymentBreakdown) | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
              </div>
              <div class="legend-list legend-list--interactive">
                <button
                  type="button"
                  [class.is-active]="!selectedPaymentMethod"
                  [attr.aria-pressed]="!selectedPaymentMethod"
                  (click)="clearPaymentFilter()"
                >
                  <i class="legend-dot legend-dot--all"></i>
                  <em>הכל</em>
                  <strong>{{ paymentTotal(reports.paymentBreakdown) | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                </button>
                <button
                  type="button"
                  [class.is-active]="selectedPaymentMethod === PaymentMethod.Cash"
                  [class.is-muted]="isPaymentMuted(PaymentMethod.Cash)"
                  [attr.aria-pressed]="selectedPaymentMethod === PaymentMethod.Cash"
                  (click)="togglePaymentFilter(PaymentMethod.Cash)"
                >
                  <i class="legend-dot legend-dot--cash"></i>
                  <em>מזומן</em>
                  <strong>{{ paymentAmount(reports.paymentBreakdown, PaymentMethod.Cash) | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                </button>
                <button
                  type="button"
                  [class.is-active]="selectedPaymentMethod === PaymentMethod.CreditCard"
                  [class.is-muted]="isPaymentMuted(PaymentMethod.CreditCard)"
                  [attr.aria-pressed]="selectedPaymentMethod === PaymentMethod.CreditCard"
                  (click)="togglePaymentFilter(PaymentMethod.CreditCard)"
                >
                  <i class="legend-dot legend-dot--credit"></i>
                  <em>אשראי</em>
                  <strong>{{ paymentAmount(reports.paymentBreakdown, PaymentMethod.CreditCard) | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                </button>
              </div>
            </div>
          </article>

          <article class="panel report-card">
            <h2>מנות מובילות</h2>
            <div class="bar-list report-bars">
              @for (dish of reports.topDishes; track dish.menuItemId) {
                <div>
                  <span>{{ dish.name }}</span>
                  <strong>{{ dish.quantity }} מנות</strong>
                  <i [style.width.%]="barWidth(dish.quantity, maxDishQuantity(reports.topDishes))"></i>
                </div>
              } @empty {
                <p class="muted">אין נתוני מנות מובילות להצגה.</p>
              }
            </div>
          </article>

          <article class="panel report-card">
            <h2>מנות פחות מוזמנות</h2>
            <div class="bar-list report-bars">
              @for (dish of reports.leastOrdered; track dish.menuItemId) {
                <div>
                  <span>{{ dish.name }}</span>
                  <strong>{{ dish.quantity }} מנות</strong>
                  <i [style.width.%]="barWidth(dish.quantity, maxDishQuantity(reports.leastOrdered))"></i>
                </div>
              } @empty {
                <p class="muted">אין נתוני מנות פחות מוזמנות להצגה.</p>
              }
            </div>
          </article>

          <article class="panel report-card">
            <h2>שעות עומס</h2>
            <div class="hour-chart">
              @for (hour of reports.peakHours; track hour.hour) {
                <div>
                  <i [style.height.%]="barWidth(hour.ordersCount, maxPeakOrders(reports.peakHours))"></i>
                  <span>{{ hour.hour }}</span>
                </div>
              } @empty {
                <p class="muted">אין נתוני שעות עומס להצגה.</p>
              }
            </div>
          </article>

          <article class="panel report-card">
            <h2>ביצועי מלצרים</h2>
            <div class="waiter-performance">
              @for (waiter of reports.waiterPerformance; track waiter.waiterId) {
                <div>
                  <span>{{ waiter.waiterName }}</span>
                  <strong>{{ waiter.revenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                  <small>{{ waiter.ordersCount }} הזמנות</small>
                  <i [style.width.%]="barWidth(waiter.revenue, maxWaiterRevenue(reports.waiterPerformance))"></i>
                </div>
              } @empty {
                <p class="muted">אין נתוני מלצרים להצגה.</p>
              }
            </div>
          </article>

          <article class="panel report-card">
            <div class="inline-between report-card__header">
              <h2>הזמנות מקום</h2>
              <strong>{{ reservationTotal(reports.reservationsSummary) }}</strong>
            </div>
            <div class="donut-layout">
              <div class="donut" [style.background]="reservationDonutStyle(reports.reservationsSummary)">
                <span>{{ reservationTotal(reports.reservationsSummary) }}</span>
              </div>
              <div class="legend-list legend-list--interactive">
                <button
                  type="button"
                  [class.is-active]="!selectedReservationStatus"
                  [attr.aria-pressed]="!selectedReservationStatus"
                  (click)="clearReservationFilter()"
                >
                  <i class="legend-dot legend-dot--all"></i>
                  <em>הכל</em>
                  <strong>{{ reservationTotal(reports.reservationsSummary) }}</strong>
                </button>
                <button
                  type="button"
                  [class.is-active]="selectedReservationStatus === 'pending'"
                  [class.is-muted]="isReservationMuted('pending')"
                  [attr.aria-pressed]="selectedReservationStatus === 'pending'"
                  (click)="toggleReservationFilter('pending')"
                >
                  <i class="legend-dot legend-dot--pending"></i><em>ממתינות</em><strong>{{ reports.reservationsSummary.pendingReservations }}</strong>
                </button>
                <button
                  type="button"
                  [class.is-active]="selectedReservationStatus === 'approved'"
                  [class.is-muted]="isReservationMuted('approved')"
                  [attr.aria-pressed]="selectedReservationStatus === 'approved'"
                  (click)="toggleReservationFilter('approved')"
                >
                  <i class="legend-dot legend-dot--approved"></i><em>מאושרות</em><strong>{{ reports.reservationsSummary.approvedReservations }}</strong>
                </button>
                <button
                  type="button"
                  [class.is-active]="selectedReservationStatus === 'rejected'"
                  [class.is-muted]="isReservationMuted('rejected')"
                  [attr.aria-pressed]="selectedReservationStatus === 'rejected'"
                  (click)="toggleReservationFilter('rejected')"
                >
                  <i class="legend-dot legend-dot--rejected"></i><em>נדחו</em><strong>{{ reports.reservationsSummary.rejectedReservations }}</strong>
                </button>
                <button
                  type="button"
                  [class.is-active]="selectedReservationStatus === 'cancelled'"
                  [class.is-muted]="isReservationMuted('cancelled')"
                  [attr.aria-pressed]="selectedReservationStatus === 'cancelled'"
                  (click)="toggleReservationFilter('cancelled')"
                >
                  <i class="legend-dot legend-dot--cancelled"></i><em>בוטלו</em><strong>{{ reports.reservationsSummary.cancelledReservations }}</strong>
                </button>
                <button
                  type="button"
                  [class.is-active]="selectedReservationStatus === 'arrived'"
                  [class.is-muted]="isReservationMuted('arrived')"
                  [attr.aria-pressed]="selectedReservationStatus === 'arrived'"
                  (click)="toggleReservationFilter('arrived')"
                >
                  <i class="legend-dot legend-dot--arrived"></i><em>הגיעו</em><strong>{{ reports.reservationsSummary.arrivedReservations }}</strong>
                </button>
                <button
                  type="button"
                  [class.is-active]="selectedReservationStatus === 'noShow'"
                  [class.is-muted]="isReservationMuted('noShow')"
                  [attr.aria-pressed]="selectedReservationStatus === 'noShow'"
                  (click)="toggleReservationFilter('noShow')"
                >
                  <i class="legend-dot legend-dot--no-show"></i><em>לא הגיעו</em><strong>{{ reports.reservationsSummary.noShowReservations }}</strong>
                </button>
              </div>
            </div>
          </article>

          <article class="panel report-card">
            <div class="inline-between report-card__header">
              <h2>תפוסת שולחנות</h2>
              <strong>{{ reports.tableOccupancy.occupancyRate | number: '1.0-0' }}%</strong>
            </div>
            <div class="occupancy-meter">
              <i
                class="occupancy-segment occupancy-segment--occupied"
                [class.is-muted]="isTableStatusMuted('occupied')"
                [style.width.%]="tableStatusRate(reports.tableOccupancy, 'occupied')"
              ></i>
              <i
                class="occupancy-segment occupancy-segment--available"
                [class.is-muted]="isTableStatusMuted('available')"
                [style.width.%]="tableStatusRate(reports.tableOccupancy, 'available')"
              ></i>
              <i
                class="occupancy-segment occupancy-segment--reserved"
                [class.is-muted]="isTableStatusMuted('reserved')"
                [style.width.%]="tableStatusRate(reports.tableOccupancy, 'reserved')"
              ></i>
            </div>
            <div class="chart-legend chart-legend--interactive">
              <button
                type="button"
                [class.is-active]="!selectedTableStatus"
                [attr.aria-pressed]="!selectedTableStatus"
                (click)="clearTableStatusFilter()"
              >
                <i class="legend-dot legend-dot--all"></i>הכל
              </button>
              <button
                type="button"
                [class.is-active]="selectedTableStatus === 'occupied'"
                [class.is-muted]="isTableStatusMuted('occupied')"
                [attr.aria-pressed]="selectedTableStatus === 'occupied'"
                (click)="toggleTableStatusFilter('occupied')"
              >
                <i class="legend-dot legend-dot--occupied"></i>תפוס
              </button>
              <button
                type="button"
                [class.is-active]="selectedTableStatus === 'available'"
                [class.is-muted]="isTableStatusMuted('available')"
                [attr.aria-pressed]="selectedTableStatus === 'available'"
                (click)="toggleTableStatusFilter('available')"
              >
                <i class="legend-dot legend-dot--available"></i>פנוי
              </button>
              <button
                type="button"
                [class.is-active]="selectedTableStatus === 'reserved'"
                [class.is-muted]="isTableStatusMuted('reserved')"
                [attr.aria-pressed]="selectedTableStatus === 'reserved'"
                (click)="toggleTableStatusFilter('reserved')"
              >
                <i class="legend-dot legend-dot--reserved"></i>שמור
              </button>
            </div>
            <div class="dashboard-status-grid report-status-grid">
              <span>סה״כ <strong>{{ reports.tableOccupancy.totalTables }}</strong></span>
              <span [class.is-muted]="isTableStatusMuted('occupied')" [class.is-active]="selectedTableStatus === 'occupied'">תפוסים <strong>{{ reports.tableOccupancy.occupiedTables }}</strong></span>
              <span [class.is-muted]="isTableStatusMuted('available')" [class.is-active]="selectedTableStatus === 'available'">פנויים <strong>{{ reports.tableOccupancy.availableTables }}</strong></span>
              <span [class.is-muted]="isTableStatusMuted('reserved')" [class.is-active]="selectedTableStatus === 'reserved'">שמורים <strong>{{ reports.tableOccupancy.reservedTables }}</strong></span>
            </div>
          </article>
        </div>
      } @else {
        <div class="empty-state">
          <h2>טוען דוחות...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .reports-page {
      --report-chart: var(--olive);
      --report-chart-soft: rgba(102, 112, 68, 0.18);
      display: grid;
      gap: 1.1rem;
    }

    .reports-toolbar {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) auto;
      align-items: end;
      gap: 1rem;
      border-color: rgba(61, 37, 25, 0.12);
      background: rgba(255, 248, 237, 0.76);
    }

    .reports-toolbar__filters,
    .reports-toolbar__summary {
      display: flex;
      align-items: end;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .reports-toolbar__filters label {
      min-width: 170px;
    }

    .reports-toolbar__summary {
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 850;
    }

    .reports-kpi-grid,
    .reports-analytics-grid {
      display: grid;
      gap: 16px;
    }

    .reports-kpi-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .report-kpi {
      display: grid;
      gap: 0.35rem;
      min-height: 110px;
      border-color: rgba(61, 37, 25, 0.12);
      background: rgba(255, 248, 237, 0.74);
    }

    .report-kpi span {
      color: var(--muted);
      font-weight: 850;
    }

    .report-kpi strong {
      color: var(--brown-950);
      font-size: 1.55rem;
      line-height: 1.1;
    }

    .report-kpi--primary {
      background: linear-gradient(135deg, rgba(31, 21, 17, 0.96), rgba(61, 37, 25, 0.92));
    }

    .report-kpi--primary span,
    .report-kpi--primary strong {
      color: var(--ivory);
    }

    .reports-analytics-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: stretch;
    }

    .report-card {
      display: grid;
      align-content: start;
      min-height: 292px;
      border-color: rgba(61, 37, 25, 0.12);
      background: linear-gradient(180deg, rgba(255, 248, 237, 0.84), rgba(255, 248, 237, 0.68));
      box-shadow: 0 12px 30px rgba(31, 21, 17, 0.07);
    }

    .report-card--wide {
      grid-column: span 2;
    }

    .report-card__header {
      align-items: center;
      margin-bottom: 0.8rem;
    }

    .report-card__header h2,
    .report-card h2 {
      margin: 0 0 0.75rem;
      font-size: 1.05rem;
    }

    .period-chart,
    .hour-chart {
      display: grid;
      align-items: end;
      gap: 0.85rem;
      min-height: 214px;
      padding-top: 0.35rem;
    }

    .period-chart {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .period-chart div,
    .hour-chart div {
      display: grid;
      grid-template-rows: auto minmax(116px, 1fr) auto;
      gap: 0.45rem;
      min-width: 0;
      text-align: center;
      color: var(--muted);
      font-weight: 800;
    }

    .period-chart i,
    .hour-chart i {
      align-self: end;
      justify-self: center;
      width: min(46px, 68%);
      min-height: 8px;
      border-radius: var(--radius) var(--radius) 0 0;
      background: linear-gradient(180deg, rgba(102, 112, 68, 0.74), var(--report-chart));
      box-shadow: inset 0 1px 0 rgba(255, 248, 237, 0.28);
    }

    .period-chart strong {
      color: var(--brown-950);
      font-size: 0.86rem;
      overflow-wrap: anywhere;
    }

    .hour-chart {
      grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
    }

    .donut-layout {
      display: grid;
      grid-template-columns: 142px minmax(0, 1fr);
      align-items: center;
      gap: 1rem;
    }

    .donut {
      position: relative;
      display: grid;
      place-items: center;
      width: 142px;
      aspect-ratio: 1;
      border-radius: 50%;
      background: var(--beige);
      box-shadow: inset 0 0 0 1px rgba(61, 37, 25, 0.08);
    }

    .donut::after {
      content: '';
      position: absolute;
      inset: 18px;
      border-radius: 50%;
      background: var(--ivory);
      box-shadow: 0 0 0 1px rgba(61, 37, 25, 0.06);
    }

    .donut span {
      position: relative;
      z-index: 1;
      color: var(--brown-950);
      font-weight: 950;
      text-align: center;
    }

    .legend-list,
    .waiter-performance {
      display: grid;
      gap: 0.5rem;
    }

    .legend-list span,
    .legend-list button {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.7rem;
      color: var(--muted);
      font-weight: 800;
    }

    .legend-list button,
    .chart-legend button {
      appearance: none;
      border: 1px solid transparent;
      background: transparent;
      font: inherit;
      cursor: pointer;
      transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
    }

    .legend-list button {
      width: 100%;
      padding: 0.34rem 0.48rem;
      border-radius: 999px;
      text-align: inherit;
    }

    .legend-list button:hover,
    .chart-legend button:hover,
    .legend-list button.is-active,
    .chart-legend button.is-active {
      border-color: rgba(102, 112, 68, 0.28);
      background: rgba(102, 112, 68, 0.1);
      color: var(--brown-950);
    }

    .legend-list button.is-muted,
    .chart-legend button.is-muted,
    .report-status-grid span.is-muted,
    .occupancy-segment.is-muted {
      opacity: 0.64;
    }

    .legend-list em {
      min-width: 0;
      font-style: normal;
    }

    .legend-list strong,
    .waiter-performance strong {
      color: var(--brown-950);
    }

    .chart-legend {
      display: flex;
      align-items: center;
      gap: 0.5rem 0.65rem;
      flex-wrap: wrap;
      margin-top: 0.8rem;
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 850;
    }

    .chart-legend button {
      display: inline-flex;
      align-items: center;
      gap: 0.38rem;
      min-width: 0;
      padding: 0.34rem 0.55rem;
      border-radius: 999px;
      color: inherit;
    }

    .legend-dot {
      display: inline-block;
      flex: 0 0 auto;
      width: 0.68rem;
      height: 0.68rem;
      border-radius: 999px;
      background: var(--stone);
      box-shadow: 0 0 0 2px rgba(255, 248, 237, 0.9);
    }

    .legend-dot--all {
      background: conic-gradient(var(--gold), var(--olive), #2f5f8f, var(--burgundy), var(--gold));
    }

    .legend-dot--approved,
    .legend-dot--available,
    .legend-dot--cash {
      background: var(--olive);
    }

    .legend-dot--pending,
    .legend-dot--reserved {
      background: var(--gold);
    }

    .legend-dot--credit {
      background: #2f5f8f;
    }

    .legend-dot--rejected {
      background: var(--danger);
    }

    .legend-dot--cancelled {
      background: var(--burgundy);
    }

    .legend-dot--no-show {
      background: var(--brown-900);
    }

    .legend-dot--arrived {
      background: #8ca05a;
    }

    .legend-dot--occupied {
      background: var(--brown-950);
    }

    .report-bars {
      max-height: 260px;
      overflow: auto;
      padding-inline-end: 0.2rem;
    }

    .report-bars i,
    .waiter-performance i {
      background: linear-gradient(90deg, rgba(102, 112, 68, 0.64), var(--report-chart));
    }

    .waiter-performance div {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 0.55rem;
      align-items: center;
      color: var(--muted);
      font-weight: 800;
    }

    .waiter-performance i {
      grid-column: 1 / -1;
      display: block;
      height: 8px;
      border-radius: 999px;
    }

    .occupancy-meter {
      display: flex;
      height: 12px;
      margin: 0.9rem 0 0.85rem;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(61, 37, 25, 0.1);
    }

    .occupancy-segment {
      display: block;
      min-width: 0;
      transition: opacity 0.18s ease;
    }

    .occupancy-segment--occupied {
      background: var(--brown-950);
    }

    .occupancy-segment--available {
      background: var(--olive);
    }

    .occupancy-segment--reserved {
      background: var(--gold);
    }

    .report-status-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.65rem;
      margin-top: 0.9rem;
    }

    .report-status-grid span {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.55);
      color: var(--muted);
      font-weight: 850;
      transition: border-color 0.18s ease, background 0.18s ease, opacity 0.18s ease;
    }

    .report-status-grid span.is-active {
      border-color: rgba(102, 112, 68, 0.34);
      background: rgba(102, 112, 68, 0.1);
      color: var(--brown-950);
    }

    @media (max-width: 1120px) {
      .reports-kpi-grid,
      .reports-analytics-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .report-card--wide {
        grid-column: span 2;
      }
    }

    @media (max-width: 760px) {
      .reports-toolbar,
      .reports-kpi-grid,
      .reports-analytics-grid,
      .period-chart,
      .donut-layout,
      .report-status-grid {
        grid-template-columns: 1fr;
      }

      .report-card--wide {
        grid-column: auto;
      }

      .reports-toolbar__summary {
        justify-content: flex-start;
      }

      .reports-toolbar__filters label,
      .reports-toolbar__summary .btn {
        flex: 1 1 160px;
      }

      .donut {
        width: 132px;
      }
    }
  `]
})
export class ReportsPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly defaultRange = this.currentMonthRange();
  private readonly dateRange$ = new BehaviorSubject<ReportsDateRange>(this.defaultRange);

  readonly paymentMethodLabels = paymentMethodLabels;
  readonly PaymentMethod = PaymentMethod;
  selectedFromDate = this.defaultRange.fromDate;
  selectedToDate = this.defaultRange.toDate;
  selectedPaymentMethod: PaymentMethod | null = null;
  selectedReservationStatus: ReservationLegendKey | null = null;
  selectedTableStatus: TableOccupancyKey | null = null;

  readonly reports$ = this.dateRange$.pipe(
    switchMap(({ fromDate, toDate }) => this.data.getReportsSummary(fromDate, toDate))
  );

  setFromDate(date: string): void {
    this.selectedFromDate = date;
    this.reloadReports();
  }

  setToDate(date: string): void {
    this.selectedToDate = date;
    this.reloadReports();
  }

  resetFilters(): void {
    const range = this.currentMonthRange();
    this.selectedFromDate = range.fromDate;
    this.selectedToDate = range.toDate;
    this.dateRange$.next(range);
  }

  togglePaymentFilter(method: PaymentMethod): void {
    this.selectedPaymentMethod = this.selectedPaymentMethod === method ? null : method;
  }

  clearPaymentFilter(): void {
    this.selectedPaymentMethod = null;
  }

  isPaymentMuted(method: PaymentMethod): boolean {
    return this.selectedPaymentMethod !== null && this.selectedPaymentMethod !== method;
  }

  toggleReservationFilter(status: ReservationLegendKey): void {
    this.selectedReservationStatus = this.selectedReservationStatus === status ? null : status;
  }

  clearReservationFilter(): void {
    this.selectedReservationStatus = null;
  }

  isReservationMuted(status: ReservationLegendKey): boolean {
    return this.selectedReservationStatus !== null && this.selectedReservationStatus !== status;
  }

  toggleTableStatusFilter(status: TableOccupancyKey): void {
    this.selectedTableStatus = this.selectedTableStatus === status ? null : status;
  }

  clearTableStatusFilter(): void {
    this.selectedTableStatus = null;
  }

  isTableStatusMuted(status: TableOccupancyKey): boolean {
    return this.selectedTableStatus !== null && this.selectedTableStatus !== status;
  }

  barWidth(value: number, max: number): number {
    if (!max || value <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(4, (value / max) * 100));
  }

  maxPeriodRevenue(reports: ReportsSummary): number {
    return Math.max(
      reports.daily.totalRevenue,
      reports.weekly.totalRevenue,
      reports.monthly.totalRevenue,
      reports.yearly.totalRevenue
    );
  }

  maxDishQuantity(dishes: TopDish[]): number {
    return Math.max(0, ...dishes.map((dish) => dish.quantity));
  }

  maxPeakOrders(hours: PeakHourReport[]): number {
    return Math.max(0, ...hours.map((hour) => hour.ordersCount));
  }

  maxWaiterRevenue(waiters: WaiterPerformanceReport[]): number {
    return Math.max(0, ...waiters.map((waiter) => waiter.revenue));
  }

  paymentTotal(payments: PaymentBreakdown[]): number {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  paymentAmount(payments: PaymentBreakdown[], method: PaymentMethod): number {
    return payments
      .filter((payment) => payment.method === method)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }

  reservationTotal(summary: ReservationsReportSummary): number {
    return summary.pendingReservations +
      summary.approvedReservations +
      summary.rejectedReservations +
      summary.cancelledReservations +
      summary.arrivedReservations +
      summary.noShowReservations;
  }

  paymentDonutStyle(payments: PaymentBreakdown[]): string {
    return this.donutGradient(
      [PaymentMethod.Cash, PaymentMethod.CreditCard].map((method) => ({
        value: this.paymentAmount(payments, method),
        color: this.paymentSegmentColor(method, this.isPaymentMuted(method))
      }))
    );
  }

  reservationDonutStyle(summary: ReservationsReportSummary): string {
    return this.donutGradient([
      { value: summary.pendingReservations, color: this.reservationSegmentColor('pending') },
      { value: summary.approvedReservations, color: this.reservationSegmentColor('approved') },
      { value: summary.rejectedReservations, color: this.reservationSegmentColor('rejected') },
      { value: summary.cancelledReservations, color: this.reservationSegmentColor('cancelled') },
      { value: summary.arrivedReservations, color: this.reservationSegmentColor('arrived') },
      { value: summary.noShowReservations, color: this.reservationSegmentColor('noShow') }
    ]);
  }

  tableStatusRate(report: TableOccupancyReport, status: TableOccupancyKey): number {
    if (!report.totalTables) {
      return 0;
    }

    const value = status === 'occupied'
      ? report.occupiedTables
      : status === 'available'
        ? report.availableTables
        : report.reservedTables;

    return Math.min(100, Math.max(0, (value / report.totalTables) * 100));
  }

  private reloadReports(): void {
    this.dateRange$.next({
      fromDate: this.selectedFromDate,
      toDate: this.selectedToDate
    });
  }

  private paymentSegmentColor(method: PaymentMethod, muted = false): string {
    if (muted) {
      return method === PaymentMethod.Cash ? 'rgba(102, 112, 68, 0.24)' : 'rgba(47, 95, 143, 0.24)';
    }

    return method === PaymentMethod.Cash ? 'var(--olive)' : '#2f5f8f';
  }

  private reservationSegmentColor(status: ReservationLegendKey): string {
    if (this.isReservationMuted(status)) {
      const mutedColors: Record<ReservationLegendKey, string> = {
        pending: 'rgba(199, 154, 59, 0.26)',
        approved: 'rgba(102, 112, 68, 0.24)',
        rejected: 'rgba(161, 58, 42, 0.24)',
        cancelled: 'rgba(124, 38, 48, 0.24)',
        arrived: 'rgba(140, 160, 90, 0.24)',
        noShow: 'rgba(43, 27, 20, 0.24)'
      };

      return mutedColors[status];
    }

    const colors: Record<ReservationLegendKey, string> = {
      pending: 'var(--gold)',
      approved: 'var(--olive)',
      rejected: 'var(--danger)',
      cancelled: 'var(--burgundy)',
      arrived: '#8ca05a',
      noShow: 'var(--brown-900)'
    };

    return colors[status];
  }

  private donutGradient(segments: { value: number; color: string }[]): string {
    const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
    if (!total) {
      return 'conic-gradient(rgba(61, 37, 25, 0.12) 0 100%)';
    }

    let current = 0;
    const stops = segments
      .filter((segment) => segment.value > 0)
      .map((segment) => {
        const start = current;
        current += (segment.value / total) * 100;
        return `${segment.color} ${start}% ${current}%`;
      });

    return `conic-gradient(${stops.join(', ')})`;
  }

  private currentMonthRange(): ReportsDateRange {
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
