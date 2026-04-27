import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, finalize, map, of, startWith } from 'rxjs';

import { Order, OrderItem, OrderStatus, PaymentStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import {
  orderStatusLabels,
  orderStatusTones,
  orderTypeLabels,
  paymentStatusLabels,
  paymentStatusTones
} from '../../shared/ui-labels';

interface OrderDetailsViewModel {
  order: Order | null;
  isLoading: boolean;
}

@Component({
  selector: 'app-order-details-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent, RouterLink, StatusBadgeComponent],
  template: `
    @if (vm$ | async; as vm) {
      @if (vm.isLoading) {
        <section class="page-surface narrow-page empty-state">
          <h1>טוען הזמנה...</h1>
        </section>
      } @else if (vm.order; as order) {
        <section class="page-surface order-details-page">
          <app-page-header
            eyebrow="פרטי הזמנה"
            [title]="'הזמנה #' + order.orderNumber"
            [subtitle]="customerName(order)"
          >
            <a class="btn btn-ghost" [routerLink]="ordersHomeLink">חזרה להזמנות</a>
            @if (canAddPayment(order)) {
              <a class="btn btn-gold" [routerLink]="[orderDetailsBaseLink, order.id, 'payment']">גביית תשלום</a>
            }
          </app-page-header>

          @if (errorMessage) {
            <p class="validation-note">{{ errorMessage }}</p>
          }

          <article class="panel order-hero">
            <div class="order-hero__main">
              <p class="eyebrow">נפתחה {{ order.createdAt | date: 'medium' }}</p>
              <h2>{{ customerName(order) }}</h2>
              <div class="badge-row">
                <app-status-badge [label]="orderStatusLabels[order.status]" [tone]="orderStatusTones[order.status]" />
                <app-status-badge [label]="paymentStatusLabels[order.paymentStatus]" [tone]="paymentStatusTones[order.paymentStatus]" />
                <app-status-badge [label]="orderTypeLabels[order.orderType]" tone="beige" />
              </div>
            </div>
            <div class="order-hero__total">
              <span>סה״כ הזמנה</span>
              <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              @if (!canAddPayment(order)) {
                <small>{{ paymentActionHint(order) }}</small>
              }
            </div>
          </article>

          <div class="order-details-grid">
            <article class="panel order-info-card">
              <h2>פרטי לקוח</h2>
              <dl>
                <div>
                  <dt>שם מלא</dt>
                  <dd>{{ customerName(order) }}</dd>
                </div>
                <div>
                  <dt>מספר הזמנה</dt>
                  <dd>#{{ order.orderNumber }}</dd>
                </div>
                <div>
                  <dt>נוצרה</dt>
                  <dd>{{ order.createdAt | date: 'short' }}</dd>
                </div>
              </dl>
            </article>

            <article class="panel order-info-card">
              <h2>שולחן וסוג הזמנה</h2>
              <dl>
                <div>
                  <dt>סוג הזמנה</dt>
                  <dd>{{ orderTypeLabels[order.orderType] }}</dd>
                </div>
                <div>
                  <dt>שולחנות</dt>
                  <dd class="order-table-list">
                    @for (table of order.tables; track table.id) {
                      <span>{{ table.name }}</span>
                    } @empty {
                      <span>ללא שולחן משויך</span>
                    }
                  </dd>
                </div>
              </dl>
            </article>

            <article class="panel order-info-card">
              <h2>סטטוס ותשלום</h2>
              <dl>
                <div>
                  <dt>סטטוס הזמנה</dt>
                  <dd>{{ orderStatusLabels[order.status] }}</dd>
                </div>
                <div>
                  <dt>סטטוס תשלום</dt>
                  <dd>{{ paymentStatusLabels[order.paymentStatus] }}</dd>
                </div>
              </dl>
            </article>
          </div>

          <div class="order-workspace">
            <article class="panel order-items-panel">
              <div class="inline-between order-section-title">
                <h2>מנות בהזמנה</h2>
                <strong>{{ order.items.length }} פריטים</strong>
              </div>

              <div class="order-items-table">
                <div class="order-items-table__head">
                  <span>כמות</span>
                  <span>מנה</span>
                  <span>מחיר יחידה</span>
                  <span>סה״כ</span>
                </div>
                @for (item of order.items; track item.id) {
                  <div class="order-items-table__row">
                    <strong>{{ item.quantity }}</strong>
                    <div>
                      <span>{{ item.menuItemName }}</span>
                      @if (item.notes) {
                        <small>{{ item.notes }}</small>
                      }
                    </div>
                    <span>{{ item.unitPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
                    <strong>{{ lineTotal(item) | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                  </div>
                } @empty {
                  <div class="empty-state order-items-empty">
                    <h2>אין מנות בהזמנה</h2>
                  </div>
                }
              </div>

              <div class="order-total-row">
                <span>סה״כ לתשלום</span>
                <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>
            </article>

            <aside class="order-side-panel">
              <article class="panel">
                <h2>פעולות</h2>
                <p class="muted">עדכון סטטוס ההזמנה לפי התקדמות המטבח והשירות.</p>
                <div class="status-actions">
                  @for (action of statusActions; track action.status) {
                    <button
                      type="button"
                      class="btn btn-small btn-ghost status-action"
                      [class.status-action--active]="order.status === action.status"
                      [class.status-action--complete]="action.status === OrderStatus.Completed"
                      [class.status-action--cancel]="action.status === OrderStatus.Cancelled"
                      [disabled]="statusActionDisabled(order, action.status)"
                      (click)="setStatus(action.status)"
                    >
                      {{ action.label }}
                    </button>
                  }
                </div>
                @if (isUpdating) {
                  <p class="muted order-action-note">מעדכנים סטטוס...</p>
                }
                @if (canAddPayment(order)) {
                  <a class="btn btn-gold full" [routerLink]="[orderDetailsBaseLink, order.id, 'payment']">מעבר לתשלום</a>
                } @else {
                  <p class="success-note">{{ paymentActionHint(order) }}</p>
                }
              </article>

              <article class="panel">
                <h2>הערות</h2>
                @if (order.notes) {
                  <p class="note">{{ order.notes }}</p>
                } @else {
                  <p class="muted">לא נוספו הערות להזמנה.</p>
                }
              </article>
            </aside>
          </div>
        </section>
      } @else {
        <section class="page-surface narrow-page empty-state">
          <h1>{{ loadErrorMessage || 'לא מצאנו את ההזמנה המבוקשת.' }}</h1>
          <a class="btn btn-dark" [routerLink]="ordersHomeLink">חזרה להזמנות</a>
        </section>
      }
    }
  `,
  styles: [`
    .order-details-page {
      display: grid;
      gap: 1rem;
    }

    .order-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: center;
      background:
        linear-gradient(135deg, rgba(31, 21, 17, 0.96), rgba(61, 37, 25, 0.9)),
        var(--brown-950);
      color: var(--ivory);
    }

    .order-hero h2,
    .order-hero .eyebrow {
      color: var(--ivory);
    }

    .order-hero h2 {
      margin-block: 0 0.8rem;
      font-size: 2rem;
    }

    .order-hero__total {
      display: grid;
      gap: 0.2rem;
      min-width: 210px;
      padding: 1rem;
      border: 1px solid rgba(255, 248, 237, 0.16);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.08);
      text-align: center;
    }

    .order-hero__total span,
    .order-hero__total small {
      color: rgba(255, 248, 237, 0.76);
      font-weight: 850;
    }

    .order-hero__total strong {
      color: var(--ivory);
      font-size: 2rem;
      line-height: 1.1;
    }

    .order-details-grid,
    .order-workspace {
      display: grid;
      gap: 18px;
    }

    .order-details-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .order-workspace {
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      align-items: start;
    }

    .order-info-card h2,
    .order-items-panel h2,
    .order-side-panel h2 {
      margin-bottom: 0.8rem;
    }

    .order-info-card dl {
      display: grid;
      gap: 0.85rem;
      margin: 0;
    }

    .order-info-card dl div {
      display: grid;
      gap: 0.15rem;
    }

    .order-info-card dt {
      color: var(--muted);
      font-size: 0.86rem;
      font-weight: 850;
    }

    .order-info-card dd {
      margin: 0;
      color: var(--brown-950);
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .order-table-list {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .order-table-list span {
      display: inline-flex;
      min-height: 28px;
      align-items: center;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(31, 21, 17, 0.08);
      color: var(--brown-950);
      font-size: 0.86rem;
      font-weight: 900;
    }

    .order-section-title {
      align-items: center;
      margin-bottom: 0.8rem;
    }

    .order-section-title h2,
    .order-section-title strong {
      margin: 0;
    }

    .order-items-table {
      display: grid;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
    }

    .order-items-table__head,
    .order-items-table__row {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr) 120px 120px;
      gap: 0.8rem;
      align-items: center;
      padding: 0.85rem 1rem;
    }

    .order-items-table__head {
      background: rgba(31, 21, 17, 0.06);
      color: var(--muted);
      font-size: 0.86rem;
      font-weight: 900;
    }

    .order-items-table__row + .order-items-table__row {
      border-top: 1px solid var(--line);
    }

    .order-items-table__row div {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }

    .order-items-table__row div span {
      color: var(--brown-950);
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .order-items-table__row small {
      color: var(--muted);
      font-weight: 750;
    }

    .order-items-empty {
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .order-total-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--line);
      color: var(--brown-950);
      font-size: 1.15rem;
      font-weight: 950;
    }

    .order-side-panel {
      display: grid;
      gap: 18px;
    }

    .status-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem;
      margin-bottom: 1rem;
    }

    .status-action {
      min-height: 40px;
    }

    .status-action--active {
      border-color: var(--brown-950);
      background: var(--brown-950);
      color: var(--ivory);
    }

    .status-action--complete:not(.status-action--active) {
      border-color: rgba(102, 112, 68, 0.34);
      color: var(--olive-dark);
    }

    .status-action--cancel:not(.status-action--active) {
      border-color: rgba(161, 58, 42, 0.34);
      color: var(--danger);
    }

    .order-action-note {
      margin-bottom: 1rem;
      font-weight: 850;
    }

    @media (max-width: 980px) {
      .order-hero,
      .order-details-grid,
      .order-workspace {
        grid-template-columns: 1fr;
      }

      .order-hero__total {
        min-width: 0;
        text-align: start;
      }
    }

    @media (max-width: 680px) {
      .order-items-table__head {
        display: none;
      }

      .order-items-table__row {
        grid-template-columns: 1fr;
        gap: 0.35rem;
      }

      .order-items-table__row > strong:first-child::before {
        content: 'כמות: ';
        color: var(--muted);
      }

      .order-items-table__row > span::before {
        content: 'מחיר יחידה: ';
        color: var(--muted);
        font-weight: 850;
      }

      .order-items-table__row > strong:last-child::before {
        content: 'סה״כ: ';
        color: var(--muted);
      }

      .status-actions {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class OrderDetailsPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  private readonly isAdminRoute = this.route.snapshot.pathFromRoot.some((route) => route.routeConfig?.path === 'admin') ||
    this.router.url.startsWith('/admin');

  readonly OrderStatus = OrderStatus;
  readonly PaymentStatus = PaymentStatus;
  readonly orderDetailsBaseLink = this.isAdminRoute ? '/admin/orders' : '/waiter/orders';
  readonly ordersHomeLink = this.isAdminRoute ? ['/admin/orders'] : ['/waiter'];
  readonly orderStatusLabels = orderStatusLabels;
  readonly orderStatusTones = orderStatusTones;
  readonly orderTypeLabels = orderTypeLabels;
  readonly paymentStatusLabels = paymentStatusLabels;
  readonly paymentStatusTones = paymentStatusTones;
  readonly statusActions = [
    { status: OrderStatus.InSalads, label: 'בסלטים' },
    { status: OrderStatus.InMain, label: 'בעיקריות' },
    { status: OrderStatus.Completed, label: 'הושלם' },
    { status: OrderStatus.Cancelled, label: 'ביטול' }
  ];
  readonly vm$: Observable<OrderDetailsViewModel> = Number.isFinite(this.id) && this.id > 0
    ? this.data.getOrder(this.id).pipe(
        map((order) => ({ order: order ?? null, isLoading: false })),
        catchError(() => {
          this.loadErrorMessage = 'לא הצלחנו לטעון את ההזמנה. נסו שוב בעוד רגע.';
          return of({ order: null, isLoading: false });
        }),
        startWith({ order: null, isLoading: true })
      )
    : of({ order: null, isLoading: false });

  isUpdating = false;
  errorMessage = '';
  loadErrorMessage = '';

  customerName(order: Order): string {
    return `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'לקוח ללא שם';
  }

  lineTotal(item: OrderItem): number {
    return item.lineTotal || item.quantity * item.unitPrice;
  }

  canAddPayment(order: Order): boolean {
    return order.paymentStatus !== PaymentStatus.Paid && order.status !== OrderStatus.Cancelled;
  }

  paymentActionHint(order: Order): string {
    if (order.paymentStatus === PaymentStatus.Paid) {
      return 'ההזמנה שולמה';
    }

    if (order.status === OrderStatus.Cancelled) {
      return 'הזמנה מבוטלת אינה פתוחה לתשלום';
    }

    return 'אין צורך בתשלום נוסף';
  }

  statusActionDisabled(order: Order, status: OrderStatus): boolean {
    return this.isUpdating || order.status === status;
  }

  setStatus(status: OrderStatus): void {
    if (this.isUpdating) {
      return;
    }

    this.isUpdating = true;
    this.errorMessage = '';
    this.data.updateOrderStatus(this.id, status).pipe(
      finalize(() => {
        this.isUpdating = false;
      })
    ).subscribe({
      error: () => {
        this.errorMessage = 'לא הצלחנו לעדכן את סטטוס ההזמנה. נסו שוב בעוד רגע.';
      }
    });
  }
}
