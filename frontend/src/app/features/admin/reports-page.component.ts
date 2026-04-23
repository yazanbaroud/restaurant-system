import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, PageHeaderComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="דוחות"
        title="תובנות למסעדה"
        subtitle="כרטיסי דוח ותרשימי CSS פשוטים ללא ספריית charts בשלב האב טיפוס."
      />
      @if (dashboard$ | async; as dashboard) {
        <div class="reports-grid">
          <article class="panel">
            <h2>מכירות לפי מנה</h2>
            <div class="bar-list">
              @for (dish of dashboard.topDishes; track dish.menuItemId) {
                <div>
                  <span>{{ dish.name }}</span>
                  <strong>{{ dish.quantity }} מנות</strong>
                  <i [style.width.%]="dish.quantity"></i>
                </div>
              }
            </div>
          </article>
          <article class="panel">
            <h2>פירוט תשלומים</h2>
            <div class="bar-list">
              @for (payment of dashboard.paymentBreakdown; track payment.method) {
                <div>
                  <span>{{ paymentMethodLabels[payment.method] }}</span>
                  <strong>{{ payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                  <i [style.width.%]="payment.amount / 125"></i>
                </div>
              }
            </div>
          </article>
          <article class="panel panel--warm">
            <h2>מדדי פעילות</h2>
            <div class="mini-kpis">
              <span>הזמנות פעילות: {{ dashboard.activeOrders }}</span>
              <span>הזמנות שבוטלו: {{ dashboard.cancelledOrders }}</span>
              <span>שולחנות תפוסים: {{ dashboard.occupiedTables }}</span>
              <span>בקשות ממתינות: {{ dashboard.pendingReservations }}</span>
            </div>
          </article>
        </div>
      }
    </section>
  `
})
export class ReportsPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly dashboard$ = this.data.getDashboardSummary();
  readonly paymentMethodLabels = paymentMethodLabels;
}
