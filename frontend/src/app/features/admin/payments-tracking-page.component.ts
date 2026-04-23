import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { combineLatest, map } from 'rxjs';

import { Order, Payment } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

interface PaymentRow {
  payment: Payment;
  order?: Order;
}

@Component({
  selector: 'app-payments-tracking-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="תשלומים"
        title="מעקב תשלומים"
        subtitle="רשימת תשלומים mock עם שיוך להזמנה ואמצעי תשלום."
      />
      <div class="table-like">
        <div class="table-like__head">
          <span>הזמנה</span>
          <span>לקוח</span>
          <span>אמצעי</span>
          <span>סכום</span>
          <span>שולם בתאריך</span>
        </div>
        @for (row of rows$ | async; track row.payment.id) {
          <div class="table-like__row">
            <span>#{{ row.order?.orderNumber ?? row.payment.orderId }}</span>
            <span>{{ row.order?.customerFirstName ?? 'לקוח' }} {{ row.order?.customerLastName ?? '' }}</span>
            <span>{{ paymentMethodLabels[row.payment.method] }}</span>
            <strong>{{ row.payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            <span>{{ row.payment.paidAt | date: 'short' }}</span>
          </div>
        }
      </div>
    </section>
  `
})
export class PaymentsTrackingPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly paymentMethodLabels = paymentMethodLabels;
  readonly rows$ = combineLatest([this.data.getPayments(), this.data.getOrders()]).pipe(
    map(([payments, orders]) =>
      payments.map((payment) => ({
        payment,
        order: orders.find((order) => order.id === payment.orderId)
      }))
    )
  );
}
