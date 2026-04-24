import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';

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

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      <div class="resource-grid">
        @for (order of activeOrders$ | async; track order.id) {
          <app-order-card
            [order]="order"
            [detailsLink]="['/waiter/orders', order.id]"
            [showStatusActions]="!isUpdating(order.id)"
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
  updatingOrderId: number | null = null;
  errorMessage = '';

  readonly activeOrders$ = this.data.getOrders().pipe(
    map((orders) => orders.filter((order) => [OrderStatus.InSalads, OrderStatus.InMain].includes(order.status)))
  );

  advance(order: Order): void {
    if (this.updatingOrderId) {
      return;
    }

    const nextStatus = order.status === OrderStatus.InSalads ? OrderStatus.InMain : OrderStatus.Completed;
    this.updatingOrderId = order.id;
    this.errorMessage = '';
    this.data.updateOrderStatus(order.id, nextStatus).pipe(
      finalize(() => {
        this.updatingOrderId = null;
      })
    ).subscribe({
      error: () => {
        this.errorMessage = 'לא הצלחנו לעדכן את סטטוס ההזמנה. נסו שוב בעוד רגע.';
      }
    });
  }

  isUpdating(orderId: number): boolean {
    return this.updatingOrderId === orderId;
  }
}
