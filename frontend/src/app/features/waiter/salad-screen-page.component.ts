import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, combineLatest, finalize, map, of, startWith } from 'rxjs';

import { KitchenStatus, Order, OrderStatus, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { kitchenStatusLabels, orderTypeLabels } from '../../shared/ui-labels';

interface SaladViewModel {
  orders: Order[];
  connectionState: string;
  isLoading: boolean;
}

@Component({
  selector: 'app-salad-screen-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, PageHeaderComponent],
  template: `
    <section class="page-surface salad-page">
      <app-page-header
        eyebrow="סלטייה"
        title="מסך סלטייה"
        subtitle="הזמנות שממתינות להכנה ראשונה לפני מעבר למטבח."
      />

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (vm$ | async; as vm) {
        <div class="salad-realtime" [class.is-live]="vm.connectionState === 'connected'">
          <span></span>
          {{ connectionLabel(vm.connectionState) }}
        </div>

        @if (vm.isLoading) {
          <div class="empty-state">
            <h2>טוען הזמנות סלטייה...</h2>
          </div>
        } @else {
          <section class="salad-board">
            <section class="salad-column">
              <header>
                <div>
                  <h2>הזמנות בסלטייה</h2>
                  <p>הכנה ראשונה לפני המטבח</p>
                </div>
                <strong>{{ vm.orders.length }}</strong>
              </header>

              <div class="salad-order-list">
                @for (order of vm.orders; track order.id) {
                  <article class="salad-order-card">
                    <div class="salad-order-fields" aria-label="פרטי הזמנה">
                      <div class="salad-field">
                        <span>מספר הזמנה</span>
                        <strong>#{{ order.orderNumber }}</strong>
                      </div>

                      <div class="salad-field">
                        <span>זמן הזמנה</span>
                        <strong>{{ order.createdAt | date: 'shortTime' }}</strong>
                      </div>

                      <div class="salad-field">
                        <span>לקוח</span>
                        <strong>{{ customerName(order) }}</strong>
                      </div>

                      <div class="salad-field">
                        <span>שולחן</span>
                        <strong>{{ tableSummary(order) || 'ללא שולחן' }}</strong>
                      </div>

                      <div class="salad-field">
                        <span>סוג הזמנה</span>
                        <strong>{{ orderTypeLabels[order.orderType] }}</strong>
                      </div>

                      <div class="salad-field">
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

                    <div class="salad-items-header">
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
                        </li>
                      }
                    </ul>

                    @if (canManageSaladActions()) {
                      <button
                        type="button"
                        class="btn btn-dark full"
                        [disabled]="isUpdating(order.id)"
                        (click)="moveToKitchen(order)"
                      >
                        {{ isUpdating(order.id) ? 'מעביר...' : 'העבר למטבח' }}
                      </button>
                    }
                  </article>
                } @empty {
                  <div class="salad-empty">
                    אין הזמנות שממתינות בסלטייה
                  </div>
                }
              </div>
            </section>
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .salad-page {
      display: grid;
      gap: 1rem;
    }

    .salad-realtime {
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

    .salad-realtime span {
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 999px;
      background: var(--danger);
    }

    .salad-realtime.is-live span {
      background: var(--olive);
    }

    .salad-board {
      display: grid;
      align-items: start;
      max-width: 980px;
    }

    .salad-column {
      display: grid;
      gap: 0.75rem;
      min-width: 0;
    }

    .salad-column header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0 0.2rem;
    }

    .salad-column h2,
    .salad-column p {
      margin: 0;
    }

    .salad-column h2 {
      font-size: 1rem;
    }

    .salad-column p {
      color: var(--muted);
      font-weight: 850;
    }

    .salad-column header strong {
      display: grid;
      place-items: center;
      min-width: 2rem;
      height: 2rem;
      border-radius: 999px;
      background: var(--brown-950);
      color: var(--ivory);
    }

    .salad-order-list {
      display: grid;
      gap: 0.75rem;
      min-width: 0;
    }

    .salad-order-card {
      display: grid;
      gap: 0.85rem;
      min-width: 0;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.86);
      box-shadow: 0 10px 26px rgba(31, 21, 17, 0.08);
    }

    .salad-order-card p,
    .salad-order-card ul {
      margin: 0;
    }

    .salad-order-fields {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.55rem;
    }

    .salad-field {
      min-width: 0;
      padding: 0.55rem 0.65rem;
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.045);
    }

    .salad-field span,
    .order-note span,
    .salad-items-header span {
      display: block;
      margin-bottom: 0.1rem;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 850;
      line-height: 1.2;
    }

    .salad-field strong,
    .salad-items-header strong {
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

    .salad-items-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      min-width: 0;
      padding: 0.2rem 0.1rem 0;
    }

    .salad-items-header > div {
      min-width: 0;
    }

    .salad-items-header > div:last-child {
      flex: 0 0 auto;
      text-align: end;
    }

    .salad-order-card ul {
      display: grid;
      gap: 0.45rem;
      padding: 0;
      list-style: none;
    }

    .salad-order-card li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.5rem;
      align-items: start;
      padding: 0.45rem 0.5rem;
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.05);
    }

    .salad-order-card li strong {
      color: var(--brown-950);
    }

    .salad-order-card li span {
      min-width: 0;
      overflow-wrap: anywhere;
      font-weight: 900;
    }

    .salad-order-card li em {
      grid-column: 2;
      color: var(--muted);
      font-size: 0.86rem;
      font-style: normal;
      font-weight: 750;
      overflow-wrap: anywhere;
    }

    .salad-order-card .btn {
      min-height: 52px;
    }

    .salad-empty {
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
      .salad-board {
        max-width: none;
      }
    }

    @media (max-width: 640px) {
      .salad-column header {
        align-items: flex-start;
      }

      .salad-order-fields {
        grid-template-columns: 1fr;
      }

      .salad-items-header {
        display: grid;
        gap: 0.45rem;
      }

      .salad-items-header > div:last-child {
        text-align: start;
      }

      .salad-order-card {
        padding: 0.9rem;
      }
    }
  `]
})
export class SaladScreenPageComponent {
  private readonly auth = inject(AuthService);
  private readonly data = inject(RestaurantDataService);
  private readonly realtime = inject(RealtimeService);
  private readonly feedback = inject(FeedbackService);

  readonly kitchenStatusLabels = kitchenStatusLabels;
  readonly orderTypeLabels = orderTypeLabels;
  readonly vm$ = combineLatest([this.data.getSaladOrders(), this.realtime.connectionState$]).pipe(
    map(([orders, connectionState]) => ({
      orders: this.sortedSaladOrders(orders),
      connectionState,
      isLoading: false
    })),
    catchError((error) => {
      this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לטעון את מסך הסלטייה.');
      this.feedback.error(error, this.errorMessage);
      return of({ orders: [], connectionState: 'disconnected', isLoading: false });
    }),
    startWith({ orders: [], connectionState: 'connecting', isLoading: true })
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

  canManageSaladActions(): boolean {
    const role = this.auth.currentUser?.role;
    return role === UserRole.Admin || role === UserRole.Salad;
  }

  moveToKitchen(order: Order): void {
    if (this.updatingOrderId) {
      return;
    }

    this.updatingOrderId = order.id;
    this.errorMessage = '';
    this.data.advanceSaladStatus(order.id).pipe(
      finalize(() => {
        this.updatingOrderId = null;
      })
    ).subscribe({
      next: () => this.feedback.success('ההזמנה הועברה למטבח.'),
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו להעביר את ההזמנה למטבח.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }

  private sortedSaladOrders(orders: Order[]): Order[] {
    return orders
      .filter((order) => order.status === OrderStatus.Open && order.kitchenStatus === KitchenStatus.InSalads)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
}
