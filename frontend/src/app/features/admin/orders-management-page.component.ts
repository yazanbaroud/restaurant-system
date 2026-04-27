import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';

import { Order, OrderStatus, PaymentStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { OrderCardComponent } from '../../shared/components/order-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { orderStatusLabels, paymentStatusLabels } from '../../shared/ui-labels';

type OrderFilter = 'all' | OrderStatus;
type PaymentFilter = 'all' | PaymentStatus;

interface OrdersDateRange {
  fromDate: string;
  toDate: string;
}

@Component({
  selector: 'app-orders-management-page',
  standalone: true,
  imports: [AsyncPipe, OrderCardComponent, PageHeaderComponent, RouterLink],
  template: `
    <section class="page-surface orders-management-page">
      <app-page-header
        eyebrow="ניהול הזמנות"
        title="כל הזמנות המסעדה"
        subtitle="חיפוש וסינון לפי לקוח, מספר הזמנה, תאריך, סטטוס ותשלום."
      />

      @if (orders$ | async; as orders) {
        @if (filteredOrders(orders); as visibleOrders) {
          <div class="panel orders-toolbar">
            <label class="toolbar-search">
              חיפוש
              <input
                #orderSearch
                type="search"
                [value]="searchTerm"
                (input)="searchTerm = orderSearch.value"
                placeholder="חיפוש לפי לקוח או מספר הזמנה"
                autocomplete="off"
              />
            </label>

            <label class="toolbar-filter">
              מתאריך
              <input #orderFrom type="date" [value]="selectedFromDate" (change)="setFromDate(orderFrom.value)" />
            </label>

            <label class="toolbar-filter">
              עד תאריך
              <input #orderTo type="date" [value]="selectedToDate" (change)="setToDate(orderTo.value)" />
            </label>

            <label class="toolbar-filter">
              סטטוס
              <select #statusSelect [value]="statusFilterValue()" (change)="setStatusFilter(statusSelect.value)">
                @for (filter of filters; track filter.value) {
                  <option [value]="filterOptionValue(filter.value)">{{ filter.label }}</option>
                }
              </select>
            </label>

            <label class="toolbar-filter">
              תשלום
              <select #paymentSelect [value]="paymentFilterValue()" (change)="setPaymentFilter(paymentSelect.value)">
                <option value="all">הכל</option>
                <option [value]="paymentOptionValue(PaymentStatus.Unpaid)">{{ paymentStatusLabels[PaymentStatus.Unpaid] }}</option>
                <option [value]="paymentOptionValue(PaymentStatus.Paid)">{{ paymentStatusLabels[PaymentStatus.Paid] }}</option>
              </select>
            </label>

            <div class="orders-toolbar-actions">
              <a class="btn btn-gold" routerLink="/admin/orders/new">הזמנה חדשה</a>
              <button type="button" class="btn btn-ghost" (click)="resetFilters()">איפוס סינון</button>
            </div>
          </div>

          <div class="orders-list-header">
            <p>מציג {{ visibleOrders.length }} מתוך {{ orders.length }} הזמנות</p>
          </div>

          @if (!orders.length) {
            <div class="empty-state">
              <h2>לא נמצאו הזמנות</h2>
            </div>
          } @else if (visibleOrders.length) {
            <div class="resource-grid orders-grid">
              @for (order of visibleOrders; track order.id) {
                <app-order-card [order]="order" [detailsLink]="['/admin/orders', order.id]" />
              }
            </div>
          } @else {
            <div class="empty-state">
              <h2>לא נמצאו הזמנות מתאימות</h2>
            </div>
          }
        }
      } @else {
        <div class="empty-state">
          <h2>טוען הזמנות...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .orders-management-page {
      display: grid;
      gap: 1rem;
    }

    .orders-toolbar {
      display: grid;
      grid-template-columns:
        minmax(220px, 1fr)
        minmax(140px, 170px)
        minmax(140px, 170px)
        minmax(145px, 170px)
        minmax(145px, 170px)
        auto;
      align-items: end;
      gap: 1rem;
    }

    .orders-toolbar-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .orders-toolbar-actions .btn {
      min-height: 44px;
      white-space: nowrap;
    }

    .orders-list-header {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 850;
      margin-top: -0.25rem;
    }

    .orders-list-header p {
      margin: 0;
    }

    .orders-grid {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    @media (max-width: 1120px) {
      .orders-toolbar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .toolbar-search,
      .orders-toolbar-actions {
        grid-column: 1 / -1;
      }

      .orders-toolbar-actions {
        justify-content: flex-start;
      }
    }

    @media (max-width: 620px) {
      .orders-toolbar,
      .orders-grid {
        grid-template-columns: 1fr;
      }

      .toolbar-search,
      .orders-toolbar-actions {
        grid-column: auto;
      }

      .orders-toolbar-actions .btn {
        flex: 1 1 150px;
      }

      .orders-list-header {
        justify-content: flex-start;
      }
    }
  `]
})
export class OrdersManagementPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly defaultDate = this.todayLocalDate();
  private readonly dateRange$ = new BehaviorSubject<OrdersDateRange>({
    fromDate: this.defaultDate,
    toDate: this.defaultDate
  });

  readonly orders$: Observable<Order[]> = this.dateRange$.pipe(
    switchMap(({ fromDate, toDate }) => this.data.getOrders(fromDate, toDate))
  );
  readonly filters: { value: OrderFilter; label: string }[] = [
    { value: 'all', label: 'הכל' },
    { value: OrderStatus.InSalads, label: orderStatusLabels[OrderStatus.InSalads] },
    { value: OrderStatus.InMain, label: orderStatusLabels[OrderStatus.InMain] },
    { value: OrderStatus.Completed, label: orderStatusLabels[OrderStatus.Completed] },
    { value: OrderStatus.Cancelled, label: orderStatusLabels[OrderStatus.Cancelled] }
  ];

  readonly PaymentStatus = PaymentStatus;
  readonly paymentStatusLabels = paymentStatusLabels;

  selectedFilter: OrderFilter = 'all';
  selectedPaymentFilter: PaymentFilter = 'all';
  selectedFromDate = this.defaultDate;
  selectedToDate = this.defaultDate;
  searchTerm = '';

  filteredOrders(orders: Order[]): Order[] {
    const search = this.normalizeSearch(this.searchTerm);

    return orders.filter((order) => {
      if (this.selectedFilter !== 'all' && order.status !== this.selectedFilter) {
        return false;
      }

      if (this.selectedPaymentFilter !== 'all' && order.paymentStatus !== this.selectedPaymentFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const firstName = order.customerFirstName ?? '';
      const lastName = order.customerLastName ?? '';
      const searchableText = [
        firstName,
        lastName,
        `${firstName} ${lastName}`,
        `${lastName} ${firstName}`,
        order.orderNumber ?? '',
        order.uniqueIdentifier ?? ''
      ].join(' ').toLowerCase();

      return searchableText.includes(search);
    });
  }

  setFromDate(date: string): void {
    this.selectedFromDate = date;
    this.reloadOrders();
  }

  setToDate(date: string): void {
    this.selectedToDate = date;
    this.reloadOrders();
  }

  resetFilters(): void {
    const today = this.todayLocalDate();
    this.searchTerm = '';
    this.selectedFilter = 'all';
    this.selectedPaymentFilter = 'all';
    this.selectedFromDate = today;
    this.selectedToDate = today;
    this.reloadOrders();
  }

  setStatusFilter(value: string): void {
    this.selectedFilter = value === 'all' ? 'all' : Number(value) as OrderStatus;
  }

  setPaymentFilter(value: string): void {
    this.selectedPaymentFilter = value === 'all' ? 'all' : Number(value) as PaymentStatus;
  }

  statusFilterValue(): string {
    return this.filterOptionValue(this.selectedFilter);
  }

  paymentFilterValue(): string {
    return this.selectedPaymentFilter === 'all' ? 'all' : this.paymentOptionValue(this.selectedPaymentFilter);
  }

  filterOptionValue(filter: OrderFilter): string {
    return filter === 'all' ? 'all' : String(filter);
  }

  paymentOptionValue(status: PaymentStatus): string {
    return String(status);
  }

  private reloadOrders(): void {
    this.dateRange$.next({
      fromDate: this.selectedFromDate,
      toDate: this.selectedToDate
    });
  }

  private todayLocalDate(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }
}
