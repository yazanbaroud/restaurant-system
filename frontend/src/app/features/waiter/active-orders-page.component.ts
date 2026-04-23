import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { Order, OrderStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { OrderCardComponent } from '../../shared/components/order-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-active-orders-page',
  standalone: true,
  imports: [AsyncPipe, OrderCardComponent, PageHeaderComponent, RouterLink],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="משמרת פעילה"
        title="הזמנות פעילות"
        subtitle="תצוגה מהירה להזמנות שנמצאות בסלטים או בעיקריות."
      >
        <a class="btn btn-gold" routerLink="/waiter/create-order">הזמנה חדשה</a>
      </app-page-header>

      <div class="resource-grid">
        @for (order of activeOrders$ | async; track order.id) {
          <app-order-card
            [order]="order"
            [detailsLink]="['/waiter/orders', order.id]"
            [showStatusActions]="true"
            (advance)="advance(order)"
          />
        } @empty {
          <div class="empty-state">
            <h2>אין הזמנות פעילות כרגע</h2>
            <a class="btn btn-gold" routerLink="/waiter/create-order">פתיחת הזמנה</a>
          </div>
        }
      </div>
    </section>
  `
})
export class ActiveOrdersPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly activeOrders$ = this.data.getOrders().pipe(
    map((orders) => orders.filter((order) => [OrderStatus.InSalads, OrderStatus.InMain].includes(order.status)))
  );

  advance(order: Order): void {
    const nextStatus = order.status === OrderStatus.InSalads ? OrderStatus.InMain : OrderStatus.Completed;
    this.data.updateOrderStatus(order.id, nextStatus);
  }
}
