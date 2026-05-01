import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, finalize, map, Observable, of, startWith, switchMap } from 'rxjs';

import { KitchenStatus, MenuCategoryRecord, MenuItem, Order, OrderItem, OrderStatus, PaymentStatus } from '../../core/models';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { kitchenStatusLabels, paymentStatusLabels } from '../../shared/ui-labels';

interface PendingLine {
  item: MenuItem;
  quantity: number;
  notes: string;
}

interface OrderViewModel {
  order: Order | null;
  menuItems: MenuItem[];
  categories: MenuCategoryRecord[];
  isLoading: boolean;
}

@Component({
  selector: 'app-order-details-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent, RouterLink],
  template: `
    @if (vm$ | async; as vm) {
      @if (vm.isLoading) {
        <section class="page-surface empty-state">
          <h1>טוען הזמנה...</h1>
        </section>
      } @else if (vm.order; as order) {
        <section class="page-surface order-screen">
          <app-page-header
            eyebrow="הזמנה"
            [title]="'#' + order.orderNumber"
            [subtitle]="customerName(order)"
          >
            <a class="btn btn-ghost" [routerLink]="ordersHomeLink">שולחנות</a>
          </app-page-header>

          @if (errorMessage) {
            <p class="validation-note">{{ errorMessage }}</p>
          }

          <div class="order-screen-layout">
            <section class="panel order-menu-panel">
              <div class="section-heading">
                <div>
                  <h2>תפריט</h2>
                  <p>{{ canEditItems(order) ? 'הוסיפו פריטים להזמנה.' : 'לא ניתן לערוך פריטים אחרי תשלום או הגשה.' }}</p>
                </div>
                <label>
                  <span>חיפוש</span>
                  <input
                    #searchBox
                    type="search"
                    [value]="menuSearchTerm"
                    placeholder="שם מנה"
                    autocomplete="off"
                    (input)="menuSearchTerm = searchBox.value"
                  />
                </label>
              </div>

              <div class="category-tabs">
                <button type="button" [class.active]="selectedCategoryId === 'all'" (click)="selectedCategoryId = 'all'">הכל</button>
                @for (category of vm.categories; track category.id) {
                  <button type="button" [class.active]="selectedCategoryId === category.id" (click)="selectedCategoryId = category.id">
                    {{ category.name }}
                  </button>
                }
              </div>

              <div class="menu-pick-list">
                @for (item of filteredMenuItems(vm.menuItems); track item.id) {
                  <button type="button" class="menu-pick" [disabled]="!canEditItems(order)" (click)="stageItem(item)">
                    <span>
                      <strong>{{ item.name }}</strong>
                      <small>{{ item.description }}</small>
                    </span>
                    <em>{{ item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</em>
                  </button>
                } @empty {
                  <div class="empty-state empty-state--compact">
                    <h2>לא נמצאו מנות</h2>
                  </div>
                }
              </div>
            </section>

            <section class="panel current-order-panel">
              <div class="section-heading">
                <div>
                  <h2>הזמנה נוכחית</h2>
                  <p>{{ order.createdAt | date: 'short' }}</p>
                </div>
                <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>

              <div class="status-row">
                <span>{{ kitchenStatusLabels[order.kitchenStatus] }}</span>
                <span>{{ paymentStatusLabels[order.paymentStatus] }}</span>
                @for (table of order.tables; track table.id) {
                  <span>{{ table.name }}</span>
                }
              </div>

              <div class="current-lines">
                @for (item of order.items; track item.id) {
                  <article class="current-line">
                    <div>
                      <strong>{{ item.menuItemName }}</strong>
                      <span>{{ lineTotal(item) | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
                    </div>
                    <div class="line-controls">
                      <button type="button" [disabled]="!canEditItems(order) || isMutating" (click)="decrementExisting(order, item)">−</button>
                      <span>{{ item.quantity }}</span>
                      <button type="button" [disabled]="!canEditItems(order) || isMutating" (click)="incrementExisting(order, item)">+</button>
                      <button type="button" class="line-remove" [disabled]="!canEditItems(order) || isMutating" (click)="removeExisting(order, item)">הסר</button>
                    </div>
                    <input
                      [value]="item.notes ?? ''"
                      placeholder="הערה למטבח"
                      [disabled]="!canEditItems(order) || isMutating"
                      (change)="updateExistingNotes(order, item, $event)"
                    />
                  </article>
                }
              </div>

              @if (pendingLines.length) {
                <div class="pending-block">
                  <h3>פריטים להוספה</h3>
                  @for (line of pendingLines; track line.item.id) {
                    <article class="current-line pending-line">
                      <div>
                        <strong>{{ line.item.name }}</strong>
                        <span>{{ line.item.price * line.quantity | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
                      </div>
                      <div class="line-controls">
                        <button type="button" (click)="decrementPending(line.item.id)">−</button>
                        <span>{{ line.quantity }}</span>
                        <button type="button" (click)="incrementPending(line.item.id)">+</button>
                        <button type="button" class="line-remove" (click)="removePending(line.item.id)">הסר</button>
                      </div>
                      <input [value]="line.notes" placeholder="הערה למטבח" (input)="updatePendingNotes(line.item.id, $event)" />
                    </article>
                  }
                </div>
              }
            </section>

            <aside class="panel order-actions-panel">
              <h2>פעולות</h2>
              <div class="order-total-box">
                <span>סך הכל</span>
                <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>
              <div class="action-stack">
                @if (pendingLines.length) {
                  <button type="button" class="btn btn-gold full" [disabled]="isMutating" (click)="addPendingItems(order)">
                    {{ isMutating ? 'מוסיף...' : 'הוספת פריטים' }}
                  </button>
                }
                @if (canAddPayment(order)) {
                  <a class="btn btn-ghost full" [routerLink]="[orderDetailsBaseLink, order.id, 'payment']">מעבר לתשלום</a>
                }
              </div>
            </aside>
          </div>
        </section>
      } @else {
        <section class="page-surface empty-state">
          <h1>{{ loadErrorMessage || 'ההזמנה לא נמצאה' }}</h1>
          <a class="btn btn-dark" [routerLink]="ordersHomeLink">חזרה לשולחנות</a>
        </section>
      }
    }
  `,
  styles: [`
    .order-screen {
      display: grid;
      gap: 1rem;
    }

    .order-screen-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }

    .order-menu-panel,
    .current-order-panel,
    .order-actions-panel {
      display: grid;
      gap: 1rem;
      align-content: start;
    }

    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 1rem;
    }

    .section-heading h2,
    .section-heading p,
    .order-actions-panel h2 {
      margin: 0;
    }

    .section-heading p {
      color: var(--muted);
      font-weight: 800;
    }

    .section-heading label {
      max-width: 260px;
    }

    .category-tabs,
    .status-row {
      display: flex;
      gap: 0.45rem;
      overflow-x: auto;
      padding-bottom: 0.2rem;
    }

    .category-tabs button,
    .status-row span {
      flex: 0 0 auto;
      min-height: 38px;
      padding: 0.5rem 0.8rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.76);
      color: var(--brown-950);
      font: inherit;
      font-weight: 900;
    }

    .category-tabs button {
      cursor: pointer;
    }

    .category-tabs button.active {
      border-color: var(--brown-950);
      background: var(--brown-950);
      color: var(--ivory);
    }

    .menu-pick-list,
    .current-lines,
    .pending-block {
      display: grid;
      gap: 0.65rem;
    }

    .menu-pick,
    .current-line {
      display: grid;
      gap: 0.65rem;
      padding: 0.85rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.68);
    }

    .menu-pick {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      color: var(--brown-950);
      text-align: start;
      cursor: pointer;
    }

    .menu-pick:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }

    .menu-pick span,
    .current-line > div:first-child {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }

    .menu-pick strong,
    .current-line strong {
      overflow-wrap: anywhere;
    }

    .menu-pick small,
    .current-line span,
    .muted {
      color: var(--muted);
      font-weight: 800;
    }

    .menu-pick em {
      font-style: normal;
      font-weight: 950;
    }

    .line-controls {
      display: grid;
      grid-template-columns: 44px 44px 44px minmax(74px, auto);
      gap: 0.4rem;
      align-items: center;
    }

    .line-controls button,
    .line-controls span {
      display: grid;
      place-items: center;
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--ivory);
      color: var(--brown-950);
      font: inherit;
      font-weight: 950;
    }

    .line-controls button {
      cursor: pointer;
    }

    .line-controls button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .line-remove {
      color: var(--danger) !important;
    }

    .pending-block {
      padding-top: 0.85rem;
      border-top: 1px solid var(--line);
    }

    .pending-block h3 {
      margin: 0;
      font-size: 1rem;
    }

    .pending-line {
      border-color: rgba(199, 154, 59, 0.48);
      background: rgba(199, 154, 59, 0.1);
    }

    .order-total-box {
      display: grid;
      gap: 0.25rem;
      padding: 1rem;
      border-radius: var(--radius);
      background: var(--brown-950);
      color: var(--ivory);
    }

    .order-total-box span {
      color: rgba(255, 248, 237, 0.75);
      font-weight: 850;
    }

    .order-total-box strong {
      color: var(--ivory);
      font-size: 1.8rem;
    }

    .action-stack {
      display: grid;
      gap: 0.65rem;
    }

    .action-stack .btn {
      min-height: 52px;
    }

    .order-actions-panel {
      position: sticky;
      bottom: 0;
      z-index: 2;
    }

    @media (min-width: 980px) {
      .order-screen-layout {
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
      }

      .order-actions-panel {
        grid-column: 1 / -1;
        position: static;
      }
    }

    @media (min-width: 1220px) {
      .order-screen-layout {
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr) 280px;
      }

      .order-actions-panel {
        grid-column: auto;
        position: sticky;
        top: 92px;
      }
    }

    @media (max-width: 680px) {
      .section-heading {
        display: grid;
      }

      .section-heading label {
        max-width: none;
      }
    }
  `]
})
export class OrderDetailsPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly feedback = inject(FeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  private readonly isAdminRoute = this.route.snapshot.pathFromRoot.some((route) => route.routeConfig?.path === 'admin') ||
    this.router.url.startsWith('/admin');

  readonly orderDetailsBaseLink = this.isAdminRoute ? '/admin/orders' : '/waiter/orders';
  readonly ordersHomeLink = this.isAdminRoute ? ['/admin/orders'] : ['/waiter'];
  readonly kitchenStatusLabels = kitchenStatusLabels;
  readonly paymentStatusLabels = paymentStatusLabels;
  readonly vm$: Observable<OrderViewModel> = Number.isFinite(this.id) && this.id > 0
    ? combineLatest([
        this.data.getOrder(this.id),
        this.data.getAvailableMenuItems(),
        this.data.getMenuCategories()
      ]).pipe(
        map(([order, menuItems, categories]) => ({ order: order ?? null, menuItems, categories, isLoading: false })),
        catchError(() => {
          this.loadErrorMessage = 'לא הצלחנו לטעון את ההזמנה.';
          return of({ order: null, menuItems: [], categories: [], isLoading: false });
        }),
        startWith({ order: null, menuItems: [], categories: [], isLoading: true })
      )
    : of({ order: null, menuItems: [], categories: [], isLoading: false });

  pendingLines: PendingLine[] = [];
  selectedCategoryId: number | 'all' = 'all';
  menuSearchTerm = '';
  isMutating = false;
  errorMessage = '';
  loadErrorMessage = '';

  customerName(order: Order): string {
    return `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'לקוח ללא שם';
  }

  lineTotal(item: OrderItem): number {
    return item.lineTotal || item.quantity * item.unitPrice;
  }

  filteredMenuItems(items: MenuItem[]): MenuItem[] {
    const search = this.menuSearchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = this.selectedCategoryId === 'all' || item.category === this.selectedCategoryId;
      const matchesSearch = !search ||
        item.name.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }

  canEditItems(order: Order): boolean {
    return order.status === OrderStatus.Open &&
      order.paymentStatus === PaymentStatus.Unpaid &&
      order.kitchenStatus !== KitchenStatus.Served;
  }

  canAddPayment(order: Order): boolean {
    return order.status === OrderStatus.Open &&
      order.paymentStatus !== PaymentStatus.Paid &&
      order.paymentStatus !== PaymentStatus.Refunded;
  }

  stageItem(item: MenuItem): void {
    const existing = this.pendingLines.find((line) => line.item.id === item.id);
    if (existing) {
      this.incrementPending(item.id);
      return;
    }

    this.pendingLines = [...this.pendingLines, { item, quantity: 1, notes: '' }];
  }

  incrementPending(itemId: number): void {
    this.pendingLines = this.pendingLines.map((line) =>
      line.item.id === itemId ? { ...line, quantity: line.quantity + 1 } : line
    );
  }

  decrementPending(itemId: number): void {
    this.pendingLines = this.pendingLines
      .map((line) => line.item.id === itemId ? { ...line, quantity: line.quantity - 1 } : line)
      .filter((line) => line.quantity > 0);
  }

  removePending(itemId: number): void {
    this.pendingLines = this.pendingLines.filter((line) => line.item.id !== itemId);
  }

  updatePendingNotes(itemId: number, event: Event): void {
    const notes = (event.target as HTMLInputElement | null)?.value ?? '';
    this.pendingLines = this.pendingLines.map((line) => line.item.id === itemId ? { ...line, notes } : line);
  }

  incrementExisting(order: Order, item: OrderItem): void {
    this.updateExistingItem(order, item, item.quantity + 1, item.notes ?? '');
  }

  decrementExisting(order: Order, item: OrderItem): void {
    if (item.quantity <= 1) {
      this.removeExisting(order, item);
      return;
    }

    this.updateExistingItem(order, item, item.quantity - 1, item.notes ?? '');
  }

  updateExistingNotes(order: Order, item: OrderItem, event: Event): void {
    const notes = (event.target as HTMLInputElement | null)?.value ?? '';
    if (notes === (item.notes ?? '')) {
      return;
    }

    this.updateExistingItem(order, item, item.quantity, notes);
  }

  removeExisting(order: Order, item: OrderItem): void {
    if (order.items.length <= 1) {
      this.errorMessage = 'הזמנה חייבת לכלול לפחות פריט אחד.';
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(`להסיר את ${item.menuItemName}?`)) {
      return;
    }

    this.runMutation(this.data.deleteOrderItem(order.id, item.id));
  }

  addPendingItems(order: Order): void {
    if (!this.pendingLines.length || this.isMutating) {
      return;
    }

    let request$: Observable<Order> = of(order);
    for (const line of this.pendingLines) {
      request$ = request$.pipe(
        switchMap(() => this.data.addOrderItem(order.id, {
          menuItemId: line.item.id,
          quantity: line.quantity,
          notes: line.notes
        }))
      );
    }

    this.runMutation(request$, () => {
      this.pendingLines = [];
    });
  }

  private updateExistingItem(order: Order, item: OrderItem, quantity: number, notes: string): void {
    this.runMutation(this.data.updateOrderItem(order.id, item.id, {
      menuItemId: item.menuItemId,
      quantity,
      notes
    }));
  }

  private runMutation(request$: Observable<Order>, onSuccess?: () => void): void {
    if (this.isMutating) {
      return;
    }

    this.isMutating = true;
    this.errorMessage = '';
    request$.pipe(
      finalize(() => {
        this.isMutating = false;
      })
    ).subscribe({
      next: () => {
        onSuccess?.();
        this.feedback.success();
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לעדכן את ההזמנה.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }
}
