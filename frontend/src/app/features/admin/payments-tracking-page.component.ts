import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map, switchMap } from 'rxjs';

import { Order, Payment, PaymentMethod } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

interface PaymentRow {
  payment: Payment;
  order?: Order;
}

interface PaymentsViewModel {
  rows: PaymentRow[];
  totalCount: number;
  totalAmount: number;
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
        subtitle="מעקב תשלומים ממערכת המסעדה, עם שיוך להזמנות ואמצעי תשלום."
      />

      @if (vm$ | async; as vm) {
        <div class="panel payments-toolbar">
          <div class="payments-filters">
            <label>
              תאריך
              <input
                #paymentDate
                type="date"
                [value]="selectedDate"
                (change)="setDateFilter(paymentDate.value)"
              />
            </label>

            <label>
              אמצעי תשלום
              <select #methodSelect [value]="methodFilterValue()" (change)="setMethodFilter(methodSelect.value)">
                <option value="all">הכל</option>
                <option [value]="paymentMethodValue(PaymentMethod.Cash)">מזומן</option>
                <option [value]="paymentMethodValue(PaymentMethod.CreditCard)">אשראי</option>
              </select>
            </label>
          </div>

          <div class="payments-summary-inline">
            <span>כמות: <strong>{{ vm.totalCount }}</strong></span>
            <span>סה״כ: <strong>{{ vm.totalAmount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong></span>
          </div>
        </div>

        @if (vm.rows.length) {
          <div class="table-like payments-table">
            <div class="table-like__head">
              <span>הזמנה</span>
              <span>לקוח</span>
              <span>אמצעי</span>
              <span>סכום</span>
              <span>שולם בתאריך</span>
            </div>
            @for (row of vm.rows; track row.payment.id) {
              <div class="table-like__row">
                <span>#{{ row.order?.orderNumber ?? row.payment.orderId }}</span>
                <span>{{ row.order?.customerFirstName ?? 'לקוח' }} {{ row.order?.customerLastName ?? '' }}</span>
                <span>{{ paymentMethodLabels[row.payment.method] }}</span>
                <strong>{{ row.payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                <span>{{ row.payment.paidAt | date: 'short' }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <h2>לא נמצאו תשלומים לתאריך ולסינון שנבחרו</h2>
          </div>
        }
      } @else {
        <div class="empty-state">
          <h2>טוען תשלומים...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .payments-toolbar {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) auto;
      gap: 1rem;
      align-items: end;
      margin-bottom: 1rem;
    }

    .payments-filters {
      display: flex;
      align-items: end;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .payments-filters label {
      min-width: 180px;
    }

    .payments-summary-inline {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
      color: var(--muted);
      font-weight: 800;
      white-space: nowrap;
    }

    .payments-summary-inline strong {
      color: var(--brown-950);
      font-size: 1rem;
    }

    .payments-table {
      max-height: min(62vh, 680px);
      overflow: auto;
    }

    .payments-table .table-like__head {
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .payments-table .table-like__row {
      align-items: center;
    }

    @media (max-width: 760px) {
      .payments-toolbar {
        grid-template-columns: 1fr;
        align-items: stretch;
      }

      .payments-filters {
        align-items: stretch;
      }

      .payments-filters label {
        min-width: min(100%, 180px);
        flex: 1 1 180px;
      }

      .payments-summary-inline {
        justify-content: flex-start;
        flex-wrap: wrap;
      }

      .payments-table {
        max-height: 68vh;
      }
    }
  `]
})
export class PaymentsTrackingPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly dateFilter$ = new BehaviorSubject(this.todayLocalDate());
  private readonly methodFilter$ = new BehaviorSubject<PaymentMethod | 'all'>('all');

  readonly PaymentMethod = PaymentMethod;
  readonly paymentMethodLabels = paymentMethodLabels;
  selectedDate = this.dateFilter$.value;
  methodFilter: PaymentMethod | 'all' = 'all';

  readonly vm$ = combineLatest([
    this.dateFilter$.pipe(switchMap((date) => this.data.getPayments(date))),
    this.data.getOrders(),
    this.methodFilter$
  ]).pipe(
    map(([payments, orders, methodFilter]) => this.createViewModel(payments, orders, methodFilter))
  );

  setDateFilter(date: string): void {
    this.selectedDate = date || this.todayLocalDate();
    this.dateFilter$.next(this.selectedDate);
  }

  setMethodFilter(value: string): void {
    this.methodFilter = value === 'all' ? 'all' : Number(value) as PaymentMethod;
    this.methodFilter$.next(this.methodFilter);
  }

  methodFilterValue(): string {
    return this.methodFilter === 'all' ? 'all' : this.paymentMethodValue(this.methodFilter);
  }

  paymentMethodValue(method: PaymentMethod): string {
    return String(method);
  }

  private createViewModel(payments: Payment[], orders: Order[], methodFilter: PaymentMethod | 'all'): PaymentsViewModel {
    const rows = payments
      .filter((payment) => methodFilter === 'all' || payment.method === methodFilter)
      .map((payment) => ({
        payment,
        order: orders.find((order) => order.id === payment.orderId)
      }));

    return {
      rows,
      totalCount: rows.length,
      totalAmount: rows.reduce((sum, row) => sum + row.payment.amount, 0)
    };
  }

  private todayLocalDate(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }
}
