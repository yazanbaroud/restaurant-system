import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, combineLatest, finalize, map, of, startWith } from 'rxjs';

import { KitchenStatus, Order, OrderItem, OrderItemStatus, OrderStatus, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { kitchenStatusLabels, orderTypeLabels } from '../../shared/ui-labels';

interface KitchenColumn {
  status: KitchenStatus;
  title: string;
  orders: Order[];
}

interface KitchenViewModel {
  columns: KitchenColumn[];
  connectionState: string;
  isLoading: boolean;
}

@Component({
  selector: 'app-kitchen-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, PageHeaderComponent],
  template: `
    <section class="page-surface kitchen-page">
      <app-page-header
        eyebrow="מטבח"
        title="מסך הכנות"
        subtitle="הזמנות מתעדכנות בזמן אמת ומתקדמות בלחיצה אחת."
      />

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (vm$ | async; as vm) {
        <div class="kitchen-realtime" [class.is-live]="vm.connectionState === 'connected'">
          <span></span>
          {{ connectionLabel(vm.connectionState) }}
        </div>

        @if (vm.isLoading) {
          <div class="empty-state">
            <h2>טוען הזמנות מטבח...</h2>
          </div>
        } @else {
          <div class="kitchen-board">
            @for (column of vm.columns; track column.status) {
              <section class="kitchen-column">
                <header>
                  <h2>{{ column.title }}</h2>
                  <strong>{{ column.orders.length }}</strong>
                </header>

                <div class="kitchen-order-list">
                  @for (order of column.orders; track order.id) {
                    <article class="kitchen-order-card">
                      <div class="kitchen-order-fields" aria-label="פרטי הזמנה">
                        <div class="kitchen-field">
                          <span>מספר הזמנה</span>
                          <strong>#{{ order.orderNumber }}</strong>
                        </div>

                        <div class="kitchen-field">
                          <span>זמן הזמנה</span>
                          <strong>{{ order.createdAt | date: 'shortTime' }}</strong>
                        </div>

                        <div class="kitchen-field">
                          <span>לקוח</span>
                          <strong>{{ customerName(order) }}</strong>
                        </div>

                        <div class="kitchen-field">
                          <span>שולחן</span>
                          <strong>{{ tableSummary(order) || 'ללא שולחן' }}</strong>
                        </div>

                        <div class="kitchen-field">
                          <span>סוג הזמנה</span>
                          <strong>{{ orderTypeLabels[order.orderType] }}</strong>
                        </div>

                        <div class="kitchen-field">
                          <span>סטטוס</span>
                          <strong>{{ kitchenStatusLabels[order.kitchenStatus] }}</strong>
                        </div>
                      </div>

                      @if (order.notes) {
                        <section class="order-note">
                          <span>הערות</span>
                          <p>{{ order.notes }}</p>
                        </section>
                      }

                      <div class="kitchen-items-header">
                        <div>
                          <span>פריטים</span>
                          <strong>פירוט מנות להכנה</strong>
                        </div>
                        <div>
                          <span>סה״כ פריטים</span>
                          <strong>{{ itemCount(order) }}</strong>
                        </div>
                      </div>

                      <ul>
                        @for (item of order.items; track item.id) {
                          <li>
                            <strong>{{ item.quantity }}</strong>
                            <span>{{ item.menuItemName }}</span>
                            @if (item.notes) {
                              <em>{{ item.notes }}</em>
                            }
                            @if (canManageKitchenActions()) {
                              <div class="item-actions">
                                <button
                                  type="button"
                                  class="item-action-button item-action-button--preparing"
                                  [class.is-active]="item.status === OrderItemStatus.Preparing"
                                  [disabled]="isItemStatusActionDisabled(item, OrderItemStatus.Preparing)"
                                  (click)="setItemStatus(order, item, OrderItemStatus.Preparing)"
                                >
                                  בהכנה
                                </button>
                                <button
                                  type="button"
                                  class="item-action-button item-action-button--ready"
                                  [class.is-active]="item.status === OrderItemStatus.Ready"
                                  [disabled]="isItemStatusActionDisabled(item, OrderItemStatus.Ready)"
                                  (click)="setItemStatus(order, item, OrderItemStatus.Ready)"
                                >
                                  מוכן
                                </button>
                              </div>
                            }
                          </li>
                        }
                      </ul>

                      @if (canManageKitchenActions()) {
                        <button
                        type="button"
                        class="btn btn-dark full"
                        [disabled]="isUpdating(order.id)"
                        (click)="advance(order)"
                      >
                        {{ isUpdating(order.id) ? 'מעדכן...' : nextActionLabel(order) }}
                        </button>
                      }
                    </article>
                  } @empty {
                    <div class="kitchen-empty">
                      אין הזמנות בסטטוס הזה
                    </div>
                  }
                </div>
              </section>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .kitchen-page {
      display: grid;
      gap: 1rem;
    }

    .kitchen-realtime {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.7rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.78);
      color: var(--muted);
      font-weight: 900;
    }

    .kitchen-realtime span {
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 999px;
      background: var(--danger);
    }

    .kitchen-realtime.is-live span {
      background: var(--olive);
    }

    .kitchen-board {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      align-items: start;
    }

    .kitchen-column {
      display: grid;
      gap: 0.75rem;
      min-width: 0;
    }

    .kitchen-column header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0 0.2rem;
    }

    .kitchen-column h2 {
      margin: 0;
      font-size: 1rem;
    }

    .kitchen-column header strong {
      display: grid;
      place-items: center;
      min-width: 2rem;
      height: 2rem;
      border-radius: 999px;
      background: var(--brown-950);
      color: var(--ivory);
    }

    .kitchen-order-list {
      display: grid;
      gap: 0.75rem;
      min-width: 0;
    }

    .kitchen-order-card {
      display: grid;
      gap: 0.85rem;
      min-width: 0;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.86);
      box-shadow: 0 10px 26px rgba(31, 21, 17, 0.08);
    }

    .kitchen-order-card p,
    .kitchen-order-card ul {
      margin: 0;
    }

    .kitchen-order-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
    }

    .kitchen-field {
      min-width: 0;
      padding: 0.55rem 0.65rem;
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.045);
    }

    .kitchen-field span,
    .order-note span,
    .kitchen-items-header span {
      display: block;
      margin-bottom: 0.1rem;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 850;
      line-height: 1.2;
    }

    .kitchen-field strong,
    .kitchen-items-header strong {
      display: block;
      min-width: 0;
      color: var(--brown-950);
      font-size: 0.98rem;
      font-weight: 920;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .order-note {
      display: grid;
      gap: 0.15rem;
      padding: 0.6rem 0.7rem;
      border-radius: var(--radius);
      background: rgba(199, 154, 59, 0.12);
    }

    .order-note p {
      min-width: 0;
      color: var(--brown-800);
      font-weight: 850;
      overflow-wrap: anywhere;
    }

    .kitchen-items-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      min-width: 0;
      padding: 0.2rem 0.1rem 0;
    }

    .kitchen-items-header > div {
      min-width: 0;
    }

    .kitchen-items-header > div:last-child {
      flex: 0 0 auto;
      text-align: end;
    }

    .kitchen-order-card ul {
      display: grid;
      gap: 0.45rem;
      padding: 0;
      list-style: none;
    }

    .kitchen-order-card li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.5rem;
      align-items: start;
      padding: 0.45rem 0.5rem;
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.05);
    }

    .kitchen-order-card li strong {
      color: var(--brown-950);
    }

    .kitchen-order-card li span {
      min-width: 0;
      overflow-wrap: anywhere;
      font-weight: 900;
    }

    .kitchen-order-card li em {
      grid-column: 2;
      color: var(--muted);
      font-size: 0.86rem;
      font-style: normal;
      font-weight: 750;
      overflow-wrap: anywhere;
    }

    .item-actions {
      grid-column: 2;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.45rem;
      min-width: 0;
      padding-top: 0.15rem;
    }

    .item-action-button {
      min-height: 40px;
      min-width: 0;
      width: 100%;
      padding: 0.45rem 0.75rem;
      border: 1px solid rgba(61, 37, 25, 0.16);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.9);
      color: var(--brown-950);
      cursor: pointer;
      font: inherit;
      font-size: 0.88rem;
      font-weight: 900;
      line-height: 1;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }

    .item-action-button:hover:not(:disabled),
    .item-action-button:focus-visible:not(:disabled) {
      border-color: rgba(61, 37, 25, 0.32);
      background: rgba(255, 248, 237, 1);
      transform: translateY(-1px);
    }

    .item-action-button.is-active {
      box-shadow: inset 0 0 0 1px rgba(31, 21, 17, 0.16), 0 6px 16px rgba(31, 21, 17, 0.08);
    }

    .item-action-button--preparing.is-active {
      border-color: rgba(199, 154, 59, 0.72);
      background: var(--gold);
      color: var(--brown-950);
    }

    .item-action-button--ready.is-active {
      border-color: rgba(102, 112, 68, 0.72);
      background: var(--olive);
      color: var(--ivory);
    }

    .item-action-button:disabled {
      cursor: not-allowed;
      transform: none;
    }

    .item-action-button:disabled:not(.is-active) {
      border-color: rgba(61, 37, 25, 0.1);
      background: rgba(31, 21, 17, 0.05);
      color: rgba(119, 104, 87, 0.72);
      opacity: 0.68;
    }

    .item-action-button.is-active:disabled {
      cursor: default;
      opacity: 1;
    }

    .kitchen-order-card .btn {
      min-height: 52px;
    }

    .kitchen-empty {
      min-height: 110px;
      display: grid;
      place-items: center;
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      color: var(--muted);
      font-weight: 850;
      text-align: center;
    }

    @media (max-width: 980px) {
      .kitchen-board {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .kitchen-order-fields {
        grid-template-columns: 1fr;
      }

      .kitchen-items-header {
        display: grid;
        gap: 0.45rem;
      }

      .kitchen-items-header > div:last-child {
        text-align: start;
      }

      .kitchen-order-card {
        padding: 0.9rem;
      }

      .item-actions {
        grid-template-columns: 1fr 1fr;
        gap: 0.45rem;
      }
    }
  `]
})
export class KitchenPageComponent {
  private readonly auth = inject(AuthService);
  private readonly data = inject(RestaurantDataService);
  private readonly realtime = inject(RealtimeService);
  private readonly feedback = inject(FeedbackService);

  readonly OrderItemStatus = OrderItemStatus;
  readonly kitchenStatusLabels = kitchenStatusLabels;
  readonly orderTypeLabels = orderTypeLabels;
  readonly statuses = [KitchenStatus.InKitchen, KitchenStatus.Ready];
  readonly vm$ = combineLatest([this.data.getKitchenOrders(), this.realtime.connectionState$]).pipe(
    map(([orders, connectionState]) => ({
      columns: this.createColumns(orders),
      connectionState,
      isLoading: false
    })),
    catchError((error) => {
      this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לטעון את מסך המטבח.');
      this.feedback.error(error, this.errorMessage);
      return of({ columns: this.createColumns([]), connectionState: 'disconnected', isLoading: false });
    }),
    startWith({ columns: this.createColumns([]), connectionState: 'connecting', isLoading: true })
  );

  updatingOrderId: number | null = null;
  errorMessage = '';

  customerName(order: Order): string {
    return `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'לקוח ללא שם';
  }

  tableSummary(order: Order): string {
    return order.tables.map((table) => table.name).filter(Boolean).join(', ');
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  nextActionLabel(order: Order): string {
    if (order.kitchenStatus === KitchenStatus.InKitchen) {
      return 'סימון מוכן';
    }

    return 'סימון הוגש';
  }

  connectionLabel(state: string): string {
    if (state === 'connected') {
      return 'מחובר לעדכונים חיים';
    }

    if (state === 'reconnecting' || state === 'connecting') {
      return 'מתחבר לעדכונים חיים';
    }

    return 'לא מחובר לעדכונים חיים';
  }

  isUpdating(orderId: number): boolean {
    return this.updatingOrderId === orderId;
  }

  canManageKitchenActions(): boolean {
    const role = this.auth.currentUser?.role;
    return role === UserRole.Admin || role === UserRole.Kitchen;
  }

  isItemStatusActionDisabled(item: OrderItem, status: OrderItemStatus): boolean {
    return Boolean(this.updatingOrderId) || item.status === status;
  }

  advance(order: Order): void {
    if (this.updatingOrderId) {
      return;
    }

    this.updatingOrderId = order.id;
    this.errorMessage = '';
    this.data.advanceKitchenStatus(order.id).pipe(
      finalize(() => {
        this.updatingOrderId = null;
      })
    ).subscribe({
      next: () => this.feedback.success(),
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לקדם את ההזמנה.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }

  setItemStatus(order: Order, item: OrderItem, status: OrderItemStatus): void {
    if (this.updatingOrderId || item.status === status) {
      return;
    }

    this.updatingOrderId = order.id;
    this.errorMessage = '';
    this.data.updateOrderItemStatus(order.id, item.id, status).pipe(
      finalize(() => {
        this.updatingOrderId = null;
      })
    ).subscribe({
      next: () => this.feedback.success(),
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לעדכן את סטטוס הפריט.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }

  private createColumns(orders: Order[]): KitchenColumn[] {
    const activeOrders = orders
      .filter((order) => order.status === OrderStatus.Open && this.statuses.includes(order.kitchenStatus))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return this.statuses.map((status) => ({
      status,
      title: kitchenStatusLabels[status],
      orders: activeOrders.filter((order) => order.kitchenStatus === status)
    }));
  }
}
