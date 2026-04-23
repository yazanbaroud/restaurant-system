import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { Order, OrderStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { OrderCardComponent } from '../../shared/components/order-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { orderStatusLabels } from '../../shared/ui-labels';

type OrderFilter = 'all' | OrderStatus;

@Component({
  selector: 'app-orders-management-page',
  standalone: true,
  imports: [AsyncPipe, OrderCardComponent, PageHeaderComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול הזמנות"
        title="כל הזמנות המסעדה"
        subtitle="סינון לפי מצב הזמנה ותשלום, כולל מעבר לפרטי הזמנה."
      />
      <div class="segmented-control">
        @for (filter of filters; track filter.value) {
          <button type="button" [class.active]="selectedFilter === filter.value" (click)="selectedFilter = filter.value">
            {{ filter.label }}
          </button>
        }
      </div>
      @if (orders$ | async; as orders) {
        <div class="resource-grid">
          @for (order of filteredOrders(orders); track order.id) {
            <app-order-card [order]="order" [detailsLink]="['/waiter/orders', order.id]" />
          }
        </div>
      }
    </section>
  `
})
export class OrdersManagementPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly orders$ = this.data.getOrders();
  readonly filters: { value: OrderFilter; label: string }[] = [
    { value: 'all', label: 'הכל' },
    { value: OrderStatus.InSalads, label: orderStatusLabels[OrderStatus.InSalads] },
    { value: OrderStatus.InMain, label: orderStatusLabels[OrderStatus.InMain] },
    { value: OrderStatus.Completed, label: orderStatusLabels[OrderStatus.Completed] },
    { value: OrderStatus.Cancelled, label: orderStatusLabels[OrderStatus.Cancelled] }
  ];

  selectedFilter: OrderFilter = 'all';

  filteredOrders(orders: Order[]): Order[] {
    if (this.selectedFilter === 'all') {
      return orders;
    }

    return orders.filter((order) => order.status === this.selectedFilter);
  }
}
