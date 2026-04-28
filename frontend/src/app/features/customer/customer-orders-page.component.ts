import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  skip,
  startWith
} from 'rxjs';

import { Order, OrderStatus, OrderType, PaymentStatus } from '../../core/models';
import { CustomerOrdersService } from '../../core/services/customer-orders.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import {
  orderStatusLabels,
  orderStatusTones,
  orderTypeLabels,
  paymentStatusLabels,
  paymentStatusTones
} from '../../shared/ui-labels';

type SelectFilter<T> = T | 'all';
type OrderStatusFilter = SelectFilter<OrderStatus>;
type PaymentStatusFilter = SelectFilter<PaymentStatus>;
type OrderTypeFilter = SelectFilter<OrderType>;
type OrderSortOption = 'newest' | 'oldest' | 'highestTotal' | 'lowestTotal';

interface FilterOption<T> {
  value: T;
  label: string;
}

interface CustomerOrderFilters {
  searchTerm: string;
  status: OrderStatusFilter;
  paymentStatus: PaymentStatusFilter;
  orderType: OrderTypeFilter;
  fromDate: string;
  toDate: string;
  sort: OrderSortOption;
}

interface CustomerOrdersViewModel {
  totalCount: number;
  filteredOrders: Order[];
  dateError: string;
  isLoading: boolean;
  hasError: boolean;
  hasDateFilter: boolean;
  isDefaultTodayFilter: boolean;
}

interface CustomerOrdersLoadState {
  orders: Order[];
  isLoading: boolean;
  hasError: boolean;
}

@Component({
  selector: 'app-customer-orders-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent, ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-surface customer-orders-page">
      <app-page-header
        eyebrow="הזמנות"
        title="ההזמנות שלי"
        subtitle="מעקב ברור אחרי כל ההזמנות שבוצעו מהחשבון שלכם, כולל סטטוס הכנה ותשלום."
      >
        <a class="btn btn-gold" routerLink="/menu">הזמנה חדשה</a>
      </app-page-header>

      <section class="customer-orders-toolbar" aria-label="סינון הזמנות">
        <label class="customer-orders-search">
          חיפוש
          <input
            type="search"
            [formControl]="searchControl"
            placeholder="חיפוש לפי מספר הזמנה או מנה"
            autocomplete="off"
          />
        </label>

        <label>
          סטטוס הזמנה
          <select [formControl]="statusControl">
            @for (option of statusOptions; track option.value) {
              <option [ngValue]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <label>
          סטטוס תשלום
          <select [formControl]="paymentStatusControl">
            @for (option of paymentStatusOptions; track option.value) {
              <option [ngValue]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <label>
          סוג הזמנה
          <select [formControl]="orderTypeControl">
            @for (option of orderTypeOptions; track option.value) {
              <option [ngValue]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <label>
          מתאריך
          <input type="date" [formControl]="fromDateControl" />
        </label>

        <label>
          עד תאריך
          <input type="date" [formControl]="toDateControl" />
        </label>

        <label>
          מיון
          <select [formControl]="sortControl">
            @for (option of sortOptions; track option.value) {
              <option [ngValue]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <div class="customer-orders-toolbar__actions">
          <button type="button" class="btn btn-ghost" (click)="resetFilters()">איפוס סינון</button>
          <button type="button" class="btn btn-ghost" (click)="showAllDates()">הצג את כל התאריכים</button>
        </div>
      </section>

      @if (vm$ | async; as vm) {
        @if (vm.isLoading) {
          <div class="empty-state">
            <h2>טוען הזמנות...</h2>
          </div>
        } @else if (vm.hasError) {
          <div class="empty-state">
            <h2>לא הצלחנו לטעון את ההזמנות</h2>
            <p class="muted">בדקו את החיבור ונסו לרענן את העמוד.</p>
          </div>
        } @else {
          @if (vm.dateError) {
            <p class="validation-note">{{ vm.dateError }}</p>
          } @else {
            @if (vm.totalCount) {
              <div class="customer-orders-count">
                מציג {{ vm.filteredOrders.length }} מתוך {{ vm.totalCount }} הזמנות
              </div>

              @if (vm.filteredOrders.length) {
                <div class="customer-orders-grid">
                  @for (order of vm.filteredOrders; track order.id) {
                    <article class="customer-order-card">
                      <div class="customer-order-card__header">
                        <div>
                          <p class="eyebrow">הזמנה</p>
                          <h2>#{{ order.orderNumber }}</h2>
                          <span class="muted">{{ order.createdAt | date: 'dd.MM.yyyy, HH:mm' }}</span>
                        </div>
                        <strong class="price">{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                      </div>

                      <div class="badge-row">
                        <app-status-badge [label]="orderStatusLabels[order.status]" [tone]="orderStatusTones[order.status]" />
                        <app-status-badge [label]="paymentStatusLabels[order.paymentStatus]" [tone]="paymentStatusTones[order.paymentStatus]" />
                        <app-status-badge [label]="orderTypeLabels[order.orderType]" tone="beige" />
                      </div>

                      <dl class="customer-order-meta">
                        <div>
                          <dt>מנות</dt>
                          <dd>{{ itemCount(order) }}</dd>
                        </div>
                        <div>
                          <dt>סוג</dt>
                          <dd>{{ orderTypeLabels[order.orderType] }}</dd>
                        </div>
                        <div>
                          <dt>תשלום</dt>
                          <dd>{{ paymentStatusLabels[order.paymentStatus] }}</dd>
                        </div>
                      </dl>

                      <div class="customer-order-card__footer">
                        <a class="btn btn-small btn-dark" [routerLink]="['/orders', order.id]">צפייה בפרטים</a>
                      </div>
                    </article>
                  }
                </div>
              } @else {
                <div class="empty-state">
                  <h2>{{ vm.isDefaultTodayFilter ? 'אין הזמנות להיום' : 'לא נמצאו הזמנות מתאימות' }}</h2>
                  <p class="muted">
                    {{ vm.isDefaultTodayFilter ? 'אפשר להציג את כל ההיסטוריה או להתחיל הזמנה חדשה.' : 'אפשר לשנות את החיפוש או לאפס את הסינון.' }}
                  </p>
                  <div class="actions-inline">
                    @if (vm.hasDateFilter) {
                      <button type="button" class="btn btn-gold" (click)="showAllDates()">הצג את כל התאריכים</button>
                    }
                    <button type="button" class="btn btn-ghost" (click)="resetFilters()">איפוס סינון</button>
                  </div>
                </div>
              }
            } @else {
              <div class="empty-state">
                <h2>עדיין אין הזמנות</h2>
                <p class="muted">כשתשלחו הזמנה מהעגלה, היא תופיע כאן למעקב.</p>
                <a class="btn btn-gold" routerLink="/menu">מעבר לתפריט</a>
              </div>
            }
          }
        }
      }
    </section>
  `,
  styles: [`
    .customer-orders-page {
      display: grid;
      gap: 1rem;
    }

    .customer-orders-toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(150px, 1fr)) repeat(2, minmax(140px, 0.85fr)) minmax(150px, 1fr) auto;
      align-items: end;
      gap: 0.85rem;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.72);
    }

    .customer-orders-toolbar label {
      display: grid;
      gap: 0.35rem;
      min-width: 0;
      color: var(--muted);
      font-weight: 850;
      font-size: 0.9rem;
    }

    .customer-orders-toolbar input,
    .customer-orders-toolbar select {
      min-width: 0;
    }

    .customer-orders-toolbar__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .customer-orders-toolbar__actions .btn {
      white-space: nowrap;
    }

    .customer-orders-count {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 850;
    }

    .customer-orders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 1rem;
    }

    .customer-order-card {
      display: grid;
      gap: 0.9rem;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.72);
      box-shadow: var(--shadow-soft);
    }

    .customer-order-card__header,
    .customer-order-card__footer {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .customer-order-card__header h2 {
      margin: 0.1rem 0 0.2rem;
      font-size: 1.05rem;
      line-height: 1.35;
      word-break: break-word;
    }

    .customer-order-meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.7rem;
      margin: 0;
    }

    .customer-order-meta div {
      display: grid;
      gap: 0.2rem;
      padding: 10px;
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.04);
    }

    .customer-order-meta dt {
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 800;
    }

    .customer-order-meta dd {
      margin: 0;
      color: var(--brown-950);
      font-weight: 900;
    }

    .customer-order-card__footer {
      align-items: center;
      color: var(--muted);
      font-weight: 850;
      justify-content: flex-end;
    }

    @media (max-width: 1180px) {
      .customer-orders-toolbar {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .customer-orders-toolbar,
      .customer-orders-grid,
      .customer-order-meta {
        grid-template-columns: 1fr;
      }

      .customer-order-card__header,
      .customer-order-card__footer,
      .customer-orders-count {
        align-items: stretch;
        flex-direction: column;
      }

      .customer-order-card__footer .btn {
        width: 100%;
      }

      .customer-orders-toolbar__actions,
      .customer-orders-toolbar__actions .btn {
        width: 100%;
      }
    }
  `]
})
export class CustomerOrdersPageComponent {
  private readonly customerOrders = inject(CustomerOrdersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly today = this.localDate();

  readonly OrderStatus = OrderStatus;
  readonly OrderType = OrderType;
  readonly PaymentStatus = PaymentStatus;
  readonly orderStatusLabels = orderStatusLabels;
  readonly orderStatusTones = orderStatusTones;
  readonly orderTypeLabels = orderTypeLabels;
  readonly paymentStatusLabels = paymentStatusLabels;
  readonly paymentStatusTones = paymentStatusTones;

  readonly statusOptions: FilterOption<OrderStatusFilter>[] = [
    { value: 'all', label: 'כל הסטטוסים' },
    { value: OrderStatus.InSalads, label: orderStatusLabels[OrderStatus.InSalads] },
    { value: OrderStatus.InMain, label: orderStatusLabels[OrderStatus.InMain] },
    { value: OrderStatus.Completed, label: orderStatusLabels[OrderStatus.Completed] },
    { value: OrderStatus.Cancelled, label: orderStatusLabels[OrderStatus.Cancelled] }
  ];

  readonly paymentStatusOptions: FilterOption<PaymentStatusFilter>[] = [
    { value: 'all', label: 'כל התשלומים' },
    { value: PaymentStatus.Unpaid, label: paymentStatusLabels[PaymentStatus.Unpaid] },
    { value: PaymentStatus.Paid, label: paymentStatusLabels[PaymentStatus.Paid] }
  ];

  readonly orderTypeOptions: FilterOption<OrderTypeFilter>[] = [
    { value: 'all', label: 'כל הסוגים' },
    { value: OrderType.DineIn, label: orderTypeLabels[OrderType.DineIn] },
    { value: OrderType.TakeAway, label: orderTypeLabels[OrderType.TakeAway] }
  ];

  readonly sortOptions: FilterOption<OrderSortOption>[] = [
    { value: 'newest', label: 'החדשות ביותר' },
    { value: 'oldest', label: 'הישנות ביותר' },
    { value: 'highestTotal', label: 'הסכום הגבוה ביותר' },
    { value: 'lowestTotal', label: 'הסכום הנמוך ביותר' }
  ];

  readonly searchControl = new FormControl(this.initialStringQuery('q'), { nonNullable: true });
  readonly statusControl = new FormControl<OrderStatusFilter>(
    this.initialEnumQuery('status', [OrderStatus.InSalads, OrderStatus.InMain, OrderStatus.Completed, OrderStatus.Cancelled]),
    { nonNullable: true }
  );
  readonly paymentStatusControl = new FormControl<PaymentStatusFilter>(
    this.initialEnumQuery('payment', [PaymentStatus.Unpaid, PaymentStatus.Paid]),
    { nonNullable: true }
  );
  readonly orderTypeControl = new FormControl<OrderTypeFilter>(
    this.initialEnumQuery('type', [OrderType.DineIn, OrderType.TakeAway]),
    { nonNullable: true }
  );
  readonly fromDateControl = new FormControl(this.initialDateQuery('from'), { nonNullable: true });
  readonly toDateControl = new FormControl(this.initialDateQuery('to'), { nonNullable: true });
  readonly sortControl = new FormControl<OrderSortOption>(this.initialSortQuery(), { nonNullable: true });

  private readonly ordersState$ = this.customerOrders.getOrders().pipe(
    map((orders): CustomerOrdersLoadState => ({
      orders,
      isLoading: false,
      hasError: false
    })),
    catchError(() => of({
      orders: [],
      isLoading: false,
      hasError: true
    } satisfies CustomerOrdersLoadState)),
    startWith({
      orders: [],
      isLoading: true,
      hasError: false
    } satisfies CustomerOrdersLoadState),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly filters$ = combineLatest({
    searchTerm: this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      debounceTime(180),
      map((value) => value.trim()),
      distinctUntilChanged()
    ),
    status: this.statusControl.valueChanges.pipe(startWith(this.statusControl.value)),
    paymentStatus: this.paymentStatusControl.valueChanges.pipe(startWith(this.paymentStatusControl.value)),
    orderType: this.orderTypeControl.valueChanges.pipe(startWith(this.orderTypeControl.value)),
    fromDate: this.fromDateControl.valueChanges.pipe(startWith(this.fromDateControl.value), distinctUntilChanged()),
    toDate: this.toDateControl.valueChanges.pipe(startWith(this.toDateControl.value), distinctUntilChanged()),
    sort: this.sortControl.valueChanges.pipe(startWith(this.sortControl.value))
  }).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly vm$ = combineLatest([this.ordersState$, this.filters$]).pipe(
    map(([state, filters]) => state.isLoading || state.hasError
      ? this.toStateViewModel(state, filters)
      : this.toViewModel(state.orders, filters)
    )
  );

  constructor() {
    this.filters$.pipe(
      skip(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((filters) => {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: this.toQueryParams(filters),
        replaceUrl: true
      });
    });
  }

  resetFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue('all');
    this.paymentStatusControl.setValue('all');
    this.orderTypeControl.setValue('all');
    this.fromDateControl.setValue(this.today);
    this.toDateControl.setValue(this.today);
    this.sortControl.setValue('newest');
  }

  showAllDates(): void {
    this.fromDateControl.setValue('');
    this.toDateControl.setValue('');
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  private toViewModel(orders: Order[], filters: CustomerOrderFilters): CustomerOrdersViewModel {
    const dateError = this.dateRangeError(filters.fromDate, filters.toDate);
    const hasDateFilter = Boolean(filters.fromDate || filters.toDate);
    const isDefaultTodayFilter = filters.fromDate === this.today && filters.toDate === this.today && !this.hasNonDateFilters(filters);

    if (dateError) {
      return {
        totalCount: orders.length,
        filteredOrders: [],
        dateError,
        isLoading: false,
        hasError: false,
        hasDateFilter,
        isDefaultTodayFilter: false
      };
    }

    const searchTerm = filters.searchTerm.toLowerCase();
    const filteredOrders = orders
      .filter((order) => this.matchesSearch(order, searchTerm))
      .filter((order) => filters.status === 'all' || order.status === filters.status)
      .filter((order) => filters.paymentStatus === 'all' || order.paymentStatus === filters.paymentStatus)
      .filter((order) => filters.orderType === 'all' || order.orderType === filters.orderType)
      .filter((order) => this.matchesDateRange(order, filters.fromDate, filters.toDate))
      .sort((a, b) => this.sortOrders(a, b, filters.sort));

    return {
      totalCount: orders.length,
      filteredOrders,
      dateError: '',
      isLoading: false,
      hasError: false,
      hasDateFilter,
      isDefaultTodayFilter
    };
  }

  private toStateViewModel(state: CustomerOrdersLoadState, filters: CustomerOrderFilters): CustomerOrdersViewModel {
    return {
      totalCount: state.orders.length,
      filteredOrders: [],
      dateError: '',
      isLoading: state.isLoading,
      hasError: state.hasError,
      hasDateFilter: Boolean(filters.fromDate || filters.toDate),
      isDefaultTodayFilter: false
    };
  }

  private hasNonDateFilters(filters: CustomerOrderFilters): boolean {
    return Boolean(filters.searchTerm)
      || filters.status !== 'all'
      || filters.paymentStatus !== 'all'
      || filters.orderType !== 'all';
  }

  private matchesSearch(order: Order, searchTerm: string): boolean {
    if (!searchTerm) {
      return true;
    }

    const searchableText = [
      order.orderNumber,
      ...order.items.map((item) => item.menuItemName)
    ].join(' ').toLowerCase();

    return searchableText.includes(searchTerm);
  }

  private matchesDateRange(order: Order, fromDate: string, toDate: string): boolean {
    const orderDate = this.localDateValue(order.createdAt);
    if (!orderDate) {
      return true;
    }

    if (fromDate && orderDate < fromDate) {
      return false;
    }

    if (toDate && orderDate > toDate) {
      return false;
    }

    return true;
  }

  private sortOrders(a: Order, b: Order, sort: OrderSortOption): number {
    if (sort === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }

    if (sort === 'highestTotal') {
      return b.totalPrice - a.totalPrice;
    }

    if (sort === 'lowestTotal') {
      return a.totalPrice - b.totalPrice;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }

  private dateRangeError(fromDate: string, toDate: string): string {
    return fromDate && toDate && fromDate > toDate
      ? 'טווח התאריכים אינו תקין.'
      : '';
  }

  private localDateValue(value: string): string {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  private toQueryParams(filters: CustomerOrderFilters): Record<string, string | number | null> {
    const showAllDates = !filters.fromDate && !filters.toDate;
    const isDefaultDateRange = filters.fromDate === this.today && filters.toDate === this.today;

    return {
      q: filters.searchTerm || null,
      status: filters.status === 'all' ? null : filters.status,
      payment: filters.paymentStatus === 'all' ? null : filters.paymentStatus,
      type: filters.orderType === 'all' ? null : filters.orderType,
      dates: showAllDates ? 'all' : null,
      from: !showAllDates && !isDefaultDateRange ? filters.fromDate || null : null,
      to: !showAllDates && !isDefaultDateRange ? filters.toDate || null : null,
      sort: filters.sort === 'newest' ? null : filters.sort
    };
  }

  private initialStringQuery(key: string): string {
    return this.route.snapshot.queryParamMap.get(key)?.trim() ?? '';
  }

  private initialDateQuery(key: string): string {
    const query = this.route.snapshot.queryParamMap;
    if (query.get('dates') === 'all') {
      return '';
    }

    const hasExplicitDateFilter = query.has('from') || query.has('to');
    const value = this.initialStringQuery(key);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    return hasExplicitDateFilter ? '' : this.today;
  }

  private initialEnumQuery<T extends number>(key: string, allowedValues: readonly T[]): SelectFilter<T> {
    const value = Number(this.route.snapshot.queryParamMap.get(key));
    return allowedValues.includes(value as T) ? value as T : 'all';
  }

  private initialSortQuery(): OrderSortOption {
    const value = this.initialStringQuery('sort') as OrderSortOption;
    return this.sortOptions.some((option) => option.value === value) ? value : 'newest';
  }

  private localDate(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }
}
