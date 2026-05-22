import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, combineLatest, finalize, map, of, startWith } from 'rxjs';

import { KitchenStatus, Order, OrderStatus, OrderType, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { kitchenStatusLabels, orderTypeLabels } from '../../shared/ui-labels';

type SaladQueueFilter = 'all' | 'dineIn' | 'takeAway' | 'notes';

interface SaladViewModel {
  orders: Order[];
  connectionState: string;
  isLoading: boolean;
}

@Component({
  selector: 'app-salad-screen-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent],
  template: `
    <section class="page-surface salad-page" dir="rtl">
      <app-page-header
        eyebrow="סלטיה"
        title="הזמנות בסלטיה"
        subtitle="הזמנות חדשות מהמלצרים, מוכנות למיון ולהעברה למטבח הפנימי."
      />

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (vm$ | async; as vm) {
        <section class="salad-status-strip" aria-label="מצב תור הסלטיה">
          <article class="salad-metric salad-metric--primary">
            <span>בתור</span>
            <strong>{{ vm.orders.length }}</strong>
          </article>
          <article class="salad-metric">
            <span>פריטים</span>
            <strong>{{ totalItems(vm.orders) }}</strong>
          </article>
          <article class="salad-metric">
            <span>שולחנות</span>
            <strong>{{ dineInCount(vm.orders) }}</strong>
          </article>
          <article class="salad-metric">
            <span>איסוף</span>
            <strong>{{ takeAwayCount(vm.orders) }}</strong>
          </article>
        </section>

        <section class="panel salad-toolbar">
          <div class="salad-live-state" [class.is-live]="vm.connectionState === 'connected'" [class.is-pending]="vm.connectionState === 'connecting' || vm.connectionState === 'reconnecting'">
            <span></span>
            {{ connectionLabel(vm.connectionState) }}
          </div>

          <label class="salad-search">
            חיפוש
            <input
              #queueSearch
              type="search"
              [value]="searchTerm"
              placeholder="מספר הזמנה, לקוח, שולחן או מנה"
              autocomplete="off"
              (input)="searchTerm = queueSearch.value"
            />
          </label>

          <div class="segmented-control salad-filters" aria-label="סינון תור סלטיה">
            @for (filter of filters; track filter.value) {
              <button type="button" [class.active]="selectedFilter === filter.value" (click)="selectedFilter = filter.value">
                <span>{{ filter.label }}</span>
                <strong>{{ filterCount(vm.orders, filter.value) }}</strong>
              </button>
            }
          </div>
        </section>

        @if (vm.isLoading) {
          <div class="empty-state salad-loading-state">
            <h2>טוען הזמנות סלטיה...</h2>
            <p>בודקים מה מחכה לתחנה.</p>
          </div>
        } @else {
          @if (visibleOrders(vm.orders); as orders) {
            <div class="salad-list-header">
              <p>מציג {{ orders.length }} מתוך {{ vm.orders.length }} הזמנות</p>
              @if (searchTerm || selectedFilter !== 'all') {
                <button type="button" class="btn btn-small btn-ghost" (click)="resetFilters()">איפוס</button>
              }
            </div>

            @if (orders.length) {
              <div class="salad-queue-list">
                @for (order of orders; track order.id) {
                  <article class="salad-card">
                    <header class="salad-card__header">
                      <div>
                        <p class="eyebrow">הזמנה #{{ order.orderNumber }}</p>
                        <h2>{{ customerName(order) }}</h2>
                      </div>
                      <time>{{ order.createdAt | date: 'shortTime' }}</time>
                    </header>

                    <div class="salad-badges">
                      <span class="salad-status">{{ kitchenStatusLabels[order.kitchenStatus] }}</span>
                      <span>{{ orderTypeLabels[order.orderType] }}</span>
                      @for (table of order.tables; track table.id) {
                        <span>{{ table.name }}</span>
                      }
                    </div>

                    <div class="salad-card__summary">
                      <span>{{ itemCount(order) }} פריטים</span>
                      <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                    </div>

                    @if (order.notes) {
                      <p class="order-note">{{ order.notes }}</p>
                    }

                    <ul class="salad-item-list">
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
                        class="btn btn-dark full salad-card__action"
                        [disabled]="updatingOrderId === order.id"
                        (click)="moveToKitchen(order)"
                      >
                        {{ updatingOrderId === order.id ? 'מעביר...' : 'העבר למטבח הפנימי' }}
                      </button>
                    }
                  </article>
                }
              </div>
            } @else {
              <div class="empty-state">
                <h2>אין הזמנות שמתאימות לסינון</h2>
                <button type="button" class="btn btn-ghost" (click)="resetFilters()">איפוס סינון</button>
              </div>
            }
          }
        }
      }
    </section>
  `,
  styles: [`
    .salad-page {
      width: min(1380px, calc(100% - 32px));
      display: grid;
      gap: 1rem;
    }

    .salad-status-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .salad-metric {
      position: relative;
      overflow: hidden;
      min-height: 104px;
      display: grid;
      align-content: center;
      gap: 0.2rem;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 250, 242, 0.88);
      box-shadow: 0 10px 26px rgba(31, 21, 17, 0.07);
    }

    .salad-metric::before {
      content: "";
      position: absolute;
      inset-inline: 0;
      top: 0;
      height: 5px;
      background: var(--olive);
    }

    .salad-metric--primary::before {
      background: linear-gradient(90deg, var(--gold), var(--olive));
    }

    .salad-metric span {
      color: var(--muted);
      font-weight: 850;
    }

    .salad-metric strong {
      color: var(--brown-950);
      font-size: 1.75rem;
      line-height: 1;
    }

    .salad-toolbar {
      display: grid;
      grid-template-columns: auto minmax(260px, 1fr) minmax(0, auto);
      align-items: end;
      gap: 1rem;
      border-color: rgba(61, 37, 25, 0.12);
      background:
        linear-gradient(135deg, rgba(102, 112, 68, 0.12), rgba(199, 154, 59, 0.1)),
        rgba(255, 248, 237, 0.9);
    }

    .salad-live-state {
      display: inline-flex;
      align-items: center;
      align-self: center;
      gap: 0.45rem;
      min-height: 42px;
      padding: 0.48rem 0.75rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.78);
      color: var(--muted);
      font-weight: 900;
      white-space: nowrap;
    }

    .salad-live-state span {
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 999px;
      background: var(--danger);
      box-shadow: 0 0 0 4px rgba(161, 58, 42, 0.12);
    }

    .salad-live-state.is-live span {
      background: var(--olive);
      box-shadow: 0 0 0 4px rgba(102, 112, 68, 0.14);
    }

    .salad-live-state.is-pending span {
      background: var(--gold);
      box-shadow: 0 0 0 4px rgba(199, 154, 59, 0.16);
    }

    .salad-search input {
      min-height: 48px;
    }

    .salad-filters {
      margin: 0;
      justify-self: end;
    }

    .salad-filters button {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      min-height: 42px;
    }

    .salad-filters button strong {
      display: grid;
      place-items: center;
      min-width: 1.65rem;
      height: 1.65rem;
      padding-inline: 0.35rem;
      border-radius: 999px;
      background: rgba(31, 21, 17, 0.08);
      color: currentColor;
      font-size: 0.78rem;
    }

    .salad-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      color: var(--muted);
      font-weight: 850;
    }

    .salad-list-header p {
      margin: 0;
    }

    .salad-queue-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
      gap: 1rem;
      max-height: min(900px, 70vh);
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.1rem;
      scrollbar-gutter: stable;
    }

    .salad-card {
      position: relative;
      display: grid;
      gap: 0.9rem;
      align-content: start;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background:
        linear-gradient(180deg, rgba(255, 250, 242, 0.94), rgba(255, 248, 237, 0.82)),
        rgba(255, 248, 237, 0.88);
      box-shadow: 0 12px 28px rgba(31, 21, 17, 0.08);
    }

    .salad-card::before {
      content: "";
      position: absolute;
      inset-inline: 0;
      top: 0;
      height: 5px;
      background: linear-gradient(90deg, var(--olive), var(--gold));
    }

    .salad-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.85rem;
      padding-top: 0.2rem;
    }

    .salad-card__header h2,
    .salad-card__header p {
      margin: 0;
    }

    .salad-card__header h2 {
      font-size: 1.16rem;
      overflow-wrap: anywhere;
    }

    .salad-card__header time {
      flex: 0 0 auto;
      color: var(--muted);
      font-weight: 850;
    }

    .salad-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .salad-badges span {
      min-height: 32px;
      padding: 0.4rem 0.65rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.72);
      color: var(--brown-950);
      font-size: 0.88rem;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .salad-badges .salad-status {
      border-color: rgba(102, 112, 68, 0.28);
      background: rgba(102, 112, 68, 0.14);
      color: var(--olive-dark);
    }

    .salad-card__summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 0.85rem;
      border-radius: var(--radius);
      background: var(--brown-950);
      color: var(--ivory);
    }

    .salad-card__summary span {
      color: rgba(255, 248, 237, 0.75);
      font-weight: 850;
    }

    .salad-card__summary strong {
      color: var(--ivory);
      white-space: nowrap;
    }

    .order-note {
      margin: 0;
      padding: 0.75rem 0.85rem;
      border-radius: var(--radius);
      background: rgba(199, 154, 59, 0.13);
      color: var(--brown-800);
      font-weight: 850;
      overflow-wrap: anywhere;
    }

    .salad-item-list {
      display: grid;
      gap: 0.55rem;
      max-height: min(380px, 40vh);
      margin: 0;
      padding: 0.05rem;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      list-style: none;
      scrollbar-gutter: stable;
    }

    .salad-item-list li {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 0.55rem;
      align-items: start;
      padding: 0.65rem 0.7rem;
      border: 1px solid rgba(61, 37, 25, 0.08);
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.045);
    }

    .salad-item-list li > strong {
      display: grid;
      place-items: center;
      min-height: 38px;
      border-radius: var(--radius);
      background: rgba(102, 112, 68, 0.16);
      color: var(--olive-dark);
      font-weight: 950;
    }

    .salad-item-list li > span {
      min-width: 0;
      color: var(--brown-950);
      font-weight: 920;
      overflow-wrap: anywhere;
    }

    .salad-item-list li > em {
      grid-column: 2;
      color: var(--muted);
      font-style: normal;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .salad-card__action {
      min-height: 52px;
      margin-top: 0.1rem;
    }

    .salad-loading-state p {
      margin: 0;
      color: var(--muted);
      font-weight: 850;
    }

    @media (max-width: 1120px) {
      .salad-status-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .salad-toolbar {
        grid-template-columns: 1fr;
      }

      .salad-live-state,
      .salad-filters {
        justify-self: stretch;
      }

      .salad-live-state {
        justify-content: center;
      }
    }

    @media (max-width: 680px) {
      .salad-page {
        width: min(100% - 20px, 1380px);
      }

      .salad-status-strip {
        grid-template-columns: 1fr;
      }

      .salad-metric {
        min-height: 86px;
      }

      .salad-queue-list {
        max-height: min(720px, 66vh);
      }

      .salad-card {
        padding: 0.9rem;
      }

      .salad-card__header {
        display: grid;
      }

      .salad-card__header time {
        justify-self: start;
      }

      .salad-card__summary {
        align-items: flex-start;
        flex-direction: column;
      }

      .salad-filters button {
        flex: 1 1 126px;
        justify-content: center;
      }

      .salad-item-list {
        max-height: min(420px, 48vh);
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
  readonly filters: { value: SaladQueueFilter; label: string }[] = [
    { value: 'all', label: 'הכל' },
    { value: 'dineIn', label: 'שולחנות' },
    { value: 'takeAway', label: 'איסוף' },
    { value: 'notes', label: 'עם הערות' }
  ];
  readonly vm$ = combineLatest([this.data.getSaladOrders(), this.realtime.connectionState$]).pipe(
    map(([orders, connectionState]) => ({
      orders: this.sortedSaladOrders(orders),
      connectionState,
      isLoading: false
    })),
    catchError((error) => {
      this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לטעון את מסך הסלטיה.');
      this.feedback.error(error, this.errorMessage);
      return of({ orders: [], connectionState: 'disconnected', isLoading: false });
    }),
    startWith({ orders: [], connectionState: 'connecting', isLoading: true })
  );

  selectedFilter: SaladQueueFilter = 'all';
  searchTerm = '';
  updatingOrderId: number | null = null;
  errorMessage = '';

  visibleOrders(orders: Order[]): Order[] {
    const search = this.searchTerm.trim().toLowerCase();
    return orders.filter((order) => this.matchesFilter(order) && this.matchesSearch(order, search));
  }

  filterCount(orders: Order[], filter: SaladQueueFilter): number {
    return orders.filter((order) => this.matchesFilter(order, filter)).length;
  }

  totalItems(orders: Order[]): number {
    return orders.reduce((sum, order) => sum + this.itemCount(order), 0);
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  dineInCount(orders: Order[]): number {
    return orders.filter((order) => order.orderType === OrderType.DineIn).length;
  }

  takeAwayCount(orders: Order[]): number {
    return orders.filter((order) => order.orderType === OrderType.TakeAway).length;
  }

  customerName(order: Order): string {
    return `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'לקוח ללא שם';
  }

  connectionLabel(state: string): string {
    if (state === 'connected') {
      return 'מחובר לעדכונים חיים';
    }

    if (state === 'reconnecting') {
      return 'מתחבר מחדש לעדכונים';
    }

    if (state === 'connecting') {
      return 'מתחבר לעדכונים חיים';
    }

    return 'לא מחובר לעדכונים חיים';
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedFilter = 'all';
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
      next: () => this.feedback.success('ההזמנה הועברה למטבח הפנימי.'),
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

  private matchesFilter(order: Order, filter = this.selectedFilter): boolean {
    if (filter === 'all') {
      return true;
    }

    if (filter === 'dineIn') {
      return order.orderType === OrderType.DineIn;
    }

    if (filter === 'takeAway') {
      return order.orderType === OrderType.TakeAway;
    }

    return Boolean(order.notes?.trim() || order.items.some((item) => item.notes?.trim()));
  }

  private matchesSearch(order: Order, search: string): boolean {
    if (!search) {
      return true;
    }

    const searchableText = [
      order.orderNumber,
      order.uniqueIdentifier,
      this.customerName(order),
      ...order.tables.map((table) => table.name),
      ...order.items.flatMap((item) => [item.menuItemName, item.notes ?? '']),
      order.notes ?? ''
    ].join(' ').toLowerCase();

    return searchableText.includes(search);
  }
}
