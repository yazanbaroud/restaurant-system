import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';

import { Order, OrderStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { OrderCardComponent } from '../../shared/components/order-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type ActiveOrderFilter = 'all' | OrderStatus.InSalads | OrderStatus.InMain;

@Component({
  selector: 'app-active-orders-page',
  standalone: true,
  imports: [AsyncPipe, OrderCardComponent, PageHeaderComponent, RouterLink],
  template: `
    <section class="page-surface waiter-active-page">
      <app-page-header
        eyebrow="משמרת פעילה"
        title="הזמנות פעילות"
        subtitle="כל ההזמנות הפתוחות לטיפול מהיר וברור במהלך המשמרת."
      >
        <a class="btn btn-gold waiter-touch-action" routerLink="/waiter/create-order">הזמנה חדשה</a>
      </app-page-header>

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (activeOrders$ | async; as activeOrders) {
        <div class="panel waiter-shift-toolbar">
          <label class="waiter-order-search">
            חיפוש
            <input
              #orderSearch
              type="search"
              [value]="searchTerm"
              placeholder="חיפוש לפי לקוח או מספר הזמנה"
              autocomplete="off"
              (input)="searchTerm = orderSearch.value"
            />
          </label>

          <div class="waiter-shift-metrics" aria-label="סינון לפי סטטוס">
            <button
              type="button"
              class="waiter-shift-metric"
              [class.active]="selectedFilter === 'all'"
              (click)="selectedFilter = 'all'"
            >
              <span>פתוחות</span>
              <strong>{{ activeOrders.length }}</strong>
            </button>
            <button
              type="button"
              class="waiter-shift-metric"
              [class.active]="selectedFilter === OrderStatus.InSalads"
              (click)="selectedFilter = OrderStatus.InSalads"
            >
              <span>בסלטים</span>
              <strong>{{ countByStatus(activeOrders, OrderStatus.InSalads) }}</strong>
            </button>
            <button
              type="button"
              class="waiter-shift-metric"
              [class.active]="selectedFilter === OrderStatus.InMain"
              (click)="selectedFilter = OrderStatus.InMain"
            >
              <span>בעיקריות</span>
              <strong>{{ countByStatus(activeOrders, OrderStatus.InMain) }}</strong>
            </button>
          </div>
        </div>

        @if (filteredOrders(activeOrders); as visibleOrders) {
          <div class="waiter-list-header">
            <p>מציג {{ visibleOrders.length }} מתוך {{ activeOrders.length }} הזמנות</p>
          </div>

          @if (!activeOrders.length) {
            <div class="empty-state">
              <h2>אין הזמנות פעילות כרגע</h2>
            </div>
          } @else if (visibleOrders.length) {
            <div class="resource-grid waiter-orders-grid">
              @for (order of visibleOrders; track order.id) {
                <app-order-card
                  class="waiter-order-card"
                  [order]="order"
                  [detailsLink]="['/waiter/orders', order.id]"
                  [showStatusActions]="!isUpdating(order.id)"
                  (advance)="advance(order)"
                />
              }
            </div>
          } @else {
            <div class="empty-state">
              <h2>אין הזמנות מתאימות כרגע</h2>
              <button type="button" class="btn btn-ghost" (click)="resetFilters()">איפוס סינון</button>
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
    .waiter-active-page {
      display: grid;
      gap: 1rem;
    }

    .waiter-touch-action {
      min-height: 46px;
      padding-inline: 18px;
    }

    .waiter-shift-toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr);
      align-items: end;
      gap: 1rem;
    }

    .waiter-order-search input {
      min-height: 48px;
    }

    .waiter-shift-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .waiter-shift-metric {
      display: grid;
      gap: 0.15rem;
      min-height: 74px;
      padding: 0.85rem 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.74);
      color: var(--brown-950);
      cursor: pointer;
      text-align: start;
      transition: border-color 0.18s ease, background 0.18s ease;
    }

    .waiter-shift-metric:hover,
    .waiter-shift-metric.active {
      border-color: rgba(199, 154, 59, 0.48);
      background: rgba(199, 154, 59, 0.12);
    }

    .waiter-shift-metric span {
      color: var(--muted);
      font-weight: 850;
    }

    .waiter-shift-metric strong {
      color: var(--brown-950);
      font-size: 1.45rem;
      line-height: 1;
    }

    .waiter-list-header {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 850;
    }

    .waiter-list-header p {
      margin: 0;
    }

    .waiter-orders-grid {
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }

    :host ::ng-deep .waiter-order-card .order-card {
      min-height: 100%;
    }

    :host ::ng-deep .waiter-order-card .actions-inline .btn {
      min-height: 42px;
      padding-inline: 14px;
    }

    @media (max-width: 900px) {
      .waiter-shift-toolbar,
      .waiter-shift-metrics,
      .waiter-orders-grid {
        grid-template-columns: 1fr;
      }

      .waiter-list-header {
        justify-content: flex-start;
      }
    }
  `]
})
export class ActiveOrdersPageComponent {
  private readonly data = inject(RestaurantDataService);
  readonly OrderStatus = OrderStatus;
  updatingOrderId: number | null = null;
  errorMessage = '';
  selectedFilter: ActiveOrderFilter = 'all';
  searchTerm = '';

  readonly activeOrders$ = this.data.getOrders().pipe(
    map((orders) => orders.filter((order) => [OrderStatus.InSalads, OrderStatus.InMain].includes(order.status)))
  );

  filteredOrders(orders: Order[]): Order[] {
    const search = this.searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const fullName = `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim().toLowerCase();
      const orderNumber = String(order.orderNumber ?? '').toLowerCase();
      const matchesStatus = this.selectedFilter === 'all' || order.status === this.selectedFilter;
      const matchesSearch = !search || fullName.includes(search) || orderNumber.includes(search);

      return matchesStatus && matchesSearch;
    });
  }

  countByStatus(orders: Order[], status: OrderStatus): number {
    return orders.filter((order) => order.status === status).length;
  }

  resetFilters(): void {
    this.selectedFilter = 'all';
    this.searchTerm = '';
  }

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
