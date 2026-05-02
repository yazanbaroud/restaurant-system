import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';

import { KitchenStatus, Order, OrderStatus } from '../../core/models';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { kitchenStatusLabels, orderStatusLabels, orderTypeLabels } from '../../shared/ui-labels';

type WaiterOrderFilter = 'all' | 'active' | 'salad' | 'kitchen' | 'ready';

interface OrdersViewModel {
  orders: Order[];
  isLoading: boolean;
}

@Component({
  selector: 'app-waiter-tables-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, PageHeaderComponent, RouterLink],
  template: `
    <section class="page-surface waiter-orders-page">
      <app-page-header
        eyebrow="משמרת"
        title="הזמנות"
        subtitle="רשימת ההזמנות הפעילות. מכאן פותחים הזמנה לעריכה או מתחילים הזמנה חדשה."
      >
        <a class="btn btn-gold" routerLink="/waiter/create-order">הזמנה חדשה</a>
      </app-page-header>

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (vm$ | async; as vm) {
        @if (vm.isLoading) {
          <div class="empty-state">
            <h2>טוען הזמנות...</h2>
          </div>
        } @else {
          <div class="panel waiter-orders-toolbar">
            <label class="waiter-orders-search">
              חיפוש
              <input
                #orderSearch
                type="search"
                [value]="searchTerm"
                placeholder="שם אורח או מספר הזמנה"
                autocomplete="off"
                (input)="searchTerm = orderSearch.value"
              />
            </label>

            <div class="segmented-control waiter-order-filters" aria-label="סינון הזמנות">
              @for (filter of filters; track filter.value) {
                <button type="button" [class.active]="selectedFilter === filter.value" (click)="selectedFilter = filter.value">
                  {{ filter.label }}
                </button>
              }
            </div>
          </div>

          @if (visibleOrders(vm.orders); as orders) {
            <div class="waiter-list-header">
              <p>מציג {{ orders.length }} מתוך {{ vm.orders.length }} הזמנות</p>
            </div>

            @if (orders.length) {
              <div class="waiter-orders-list">
                @for (order of orders; track order.id) {
                  <article class="waiter-order-card">
                    <div class="inline-between">
                      <div>
                        <p class="eyebrow">הזמנה #{{ order.orderNumber }}</p>
                        <h2>{{ customerName(order) }}</h2>
                      </div>
                      <time>{{ order.createdAt | date: 'short' }}</time>
                    </div>

                    <div class="badge-row">
                      <span>{{ orderStatusLabels[order.status] }}</span>
                      <span>{{ kitchenStatusLabels[order.kitchenStatus] }}</span>
                      <span>{{ orderTypeLabels[order.orderType] }}</span>
                      @for (table of order.tables; track table.id) {
                        <span>{{ table.name }}</span>
                      }
                    </div>

                    <ul class="compact-list">
                      @for (item of order.items.slice(0, 4); track item.id) {
                        <li>{{ item.quantity }} x {{ item.menuItemName }}</li>
                      }
                    </ul>

                    <div class="inline-between waiter-order-card__footer">
                      <small>{{ itemCount(order) }} פריטים</small>
                      <button type="button" class="btn btn-small btn-dark" (click)="openOrder(order)">פתיחה</button>
                    </div>
                  </article>
                }
              </div>
            } @else {
              <div class="empty-state">
                <h2>אין הזמנות מתאימות</h2>
                <button type="button" class="btn btn-ghost" (click)="resetFilters()">איפוס סינון</button>
              </div>
            }
          }
        }
      }
    </section>
  `,
  styles: [`
    .waiter-orders-page {
      display: grid;
      gap: 1rem;
    }

    .waiter-orders-toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto;
      align-items: end;
      gap: 1rem;
    }

    .waiter-orders-search input {
      min-height: 48px;
    }

    .waiter-order-filters {
      justify-self: end;
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

    .waiter-orders-list {
      display: grid;
      gap: 0.75rem;
    }

    .waiter-order-card {
      display: grid;
      gap: 0.8rem;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.86);
      box-shadow: 0 10px 24px rgba(31, 21, 17, 0.08);
    }

    .waiter-order-card h2,
    .waiter-order-card p,
    .waiter-order-card ul {
      margin: 0;
    }

    .waiter-order-card h2 {
      font-size: 1.15rem;
    }

    .waiter-order-card time,
    .waiter-order-card small {
      color: var(--muted);
      font-weight: 850;
    }

    .badge-row span {
      min-height: 34px;
      padding: 0.45rem 0.7rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.72);
      color: var(--brown-950);
      font-weight: 900;
    }

    .waiter-order-card__footer {
      align-items: center;
    }

    @media (max-width: 760px) {
      .waiter-orders-toolbar {
        grid-template-columns: 1fr;
      }

      .waiter-order-filters {
        justify-self: stretch;
      }
    }
  `]
})
export class TablesPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly filters: { value: WaiterOrderFilter; label: string }[] = [
    { value: 'active', label: 'פעילות' },
    { value: 'all', label: 'הכל' },
    { value: 'salad', label: 'בסלטיה' },
    { value: 'kitchen', label: 'במטבח' },
    { value: 'ready', label: 'מוכנות' }
  ];
  readonly orderStatusLabels = orderStatusLabels;
  readonly kitchenStatusLabels = kitchenStatusLabels;
  readonly orderTypeLabels = orderTypeLabels;
  readonly vm$ = this.data.getOrders().pipe(
    map((orders) => ({ orders, isLoading: false })),
    catchError((error) => {
      this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לטעון את רשימת ההזמנות.');
      this.feedback.error(error, this.errorMessage);
      return of({ orders: [], isLoading: false });
    }),
    startWith({ orders: [], isLoading: true })
  );

  selectedFilter: WaiterOrderFilter = 'active';
  searchTerm = '';
  errorMessage = '';

  visibleOrders(orders: Order[]): Order[] {
    const search = this.searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      if (!this.matchesFilter(order)) {
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

  customerName(order: Order): string {
    return `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'אורח ללא שם';
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  openOrder(order: Order): void {
    void this.router.navigate(['/waiter/orders', order.id]);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedFilter = 'active';
  }

  private matchesFilter(order: Order): boolean {
    if (this.selectedFilter === 'all') {
      return true;
    }

    if (this.selectedFilter === 'active') {
      return order.status === OrderStatus.Open;
    }

    if (this.selectedFilter === 'salad') {
      return order.status === OrderStatus.Open && order.kitchenStatus === KitchenStatus.InSalads;
    }

    if (this.selectedFilter === 'kitchen') {
      return order.status === OrderStatus.Open && order.kitchenStatus === KitchenStatus.InKitchen;
    }

    return order.status === OrderStatus.Open && order.kitchenStatus === KitchenStatus.Ready;
  }
}
