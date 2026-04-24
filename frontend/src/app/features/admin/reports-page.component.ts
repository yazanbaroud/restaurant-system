import { AsyncPipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { PaymentBreakdown, PeakHourReport, TopDish, WaiterPerformanceReport } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DecimalPipe, PageHeaderComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="דוחות"
        title="תובנות למסעדה"
        subtitle="תמונת ביצועים מלאה ממערכת הדוחות: הכנסות, מכירות, מנות, תשלומים, שעות עומס, מלצרים, הזמנות מקום ותפוסת שולחנות."
      />
      @if (reports$ | async; as reports) {
        <div class="reports-grid">
          <article class="panel panel--warm">
            <h2>סיכום הכנסות</h2>
            <div class="mini-kpis">
              <span>יומי: {{ reports.daily.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
              <span>שבועי: {{ reports.weekly.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
              <span>חודשי: {{ reports.monthly.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
              <span>שנתי: {{ reports.yearly.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
            </div>
          </article>

          <article class="panel">
            <h2>סיכום מכירות</h2>
            <div class="mini-kpis">
              <span>הכנסות: {{ reports.sales.totalRevenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
              <span>הזמנות: {{ reports.sales.ordersCount }}</span>
              <span>מנות שנמכרו: {{ reports.sales.itemsSold }}</span>
              <span>ממוצע להזמנה: {{ reports.sales.averageOrderValue | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
            </div>
          </article>

          <article class="panel">
            <h2>מנות מובילות</h2>
            <div class="bar-list">
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

          <article class="panel">
            <h2>מנות פחות מוזמנות</h2>
            <div class="bar-list">
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

          <article class="panel">
            <h2>פירוט תשלומים</h2>
            <div class="bar-list">
              @for (payment of reports.paymentBreakdown; track payment.method) {
                <div>
                  <span>{{ paymentMethodLabels[payment.method] }}</span>
                  <strong>{{ payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                  <i [style.width.%]="barWidth(payment.amount, maxPaymentAmount(reports.paymentBreakdown))"></i>
                </div>
              } @empty {
                <p class="muted">אין נתוני תשלומים להצגה.</p>
              }
            </div>
          </article>

          <article class="panel">
            <h2>שעות עומס</h2>
            <div class="bar-list">
              @for (hour of reports.peakHours; track hour.hour) {
                <div>
                  <span>{{ hour.hour }}</span>
                  <strong>{{ hour.ordersCount }} הזמנות</strong>
                  <i [style.width.%]="barWidth(hour.ordersCount, maxPeakOrders(reports.peakHours))"></i>
                </div>
              } @empty {
                <p class="muted">אין נתוני שעות עומס להצגה.</p>
              }
            </div>
          </article>

          <article class="panel">
            <h2>ביצועי מלצרים</h2>
            <div class="bar-list">
              @for (waiter of reports.waiterPerformance; track waiter.waiterId) {
                <div>
                  <span>{{ waiter.waiterName }}</span>
                  <strong>{{ waiter.revenue | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                  <i [style.width.%]="barWidth(waiter.revenue, maxWaiterRevenue(reports.waiterPerformance))"></i>
                </div>
              } @empty {
                <p class="muted">אין נתוני מלצרים להצגה.</p>
              }
            </div>
          </article>

          <article class="panel panel--warm">
            <h2>סיכום הזמנות מקום</h2>
            <div class="mini-kpis">
              <span>סה"כ: {{ reports.reservationsSummary.totalReservations }}</span>
              <span>ממתינות: {{ reports.reservationsSummary.pendingReservations }}</span>
              <span>מאושרות: {{ reports.reservationsSummary.approvedReservations }}</span>
              <span>נדחו: {{ reports.reservationsSummary.rejectedReservations }}</span>
              <span>בוטלו: {{ reports.reservationsSummary.cancelledReservations }}</span>
              <span>הגיעו: {{ reports.reservationsSummary.arrivedReservations }}</span>
              <span>לא הגיעו: {{ reports.reservationsSummary.noShowReservations }}</span>
            </div>
          </article>

          <article class="panel panel--warm">
            <h2>תפוסת שולחנות</h2>
            <div class="mini-kpis">
              <span>סה"כ שולחנות: {{ reports.tableOccupancy.totalTables }}</span>
              <span>תפוסים: {{ reports.tableOccupancy.occupiedTables }}</span>
              <span>פנויים: {{ reports.tableOccupancy.availableTables }}</span>
              <span>שמורים: {{ reports.tableOccupancy.reservedTables }}</span>
              <span>תפוסה: {{ reports.tableOccupancy.occupancyRate | number: '1.0-0' }}%</span>
            </div>
          </article>
        </div>
      }
    </section>
  `
})
export class ReportsPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly reports$ = this.data.getReportsSummary();
  readonly paymentMethodLabels = paymentMethodLabels;

  barWidth(value: number, max: number): number {
    if (!max || value <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(4, (value / max) * 100));
  }

  maxDishQuantity(dishes: TopDish[]): number {
    return Math.max(0, ...dishes.map((dish) => dish.quantity));
  }

  maxPaymentAmount(payments: PaymentBreakdown[]): number {
    return Math.max(0, ...payments.map((payment) => payment.amount));
  }

  maxPeakOrders(hours: PeakHourReport[]): number {
    return Math.max(0, ...hours.map((hour) => hour.ordersCount));
  }

  maxWaiterRevenue(waiters: WaiterPerformanceReport[]): number {
    return Math.max(0, ...waiters.map((waiter) => waiter.revenue));
  }
}
