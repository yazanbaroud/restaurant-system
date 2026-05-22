import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, finalize, map, of, startWith, tap } from 'rxjs';

import { MenuCategoryRecord, MenuItem, OrderType, Table, TableStatus } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { controlError } from '../../shared/form-validation';
import { orderTypeLabels } from '../../shared/ui-labels';

interface CartLine {
  item: MenuItem;
  quantity: number;
  notes: string;
}

interface CreateOrderViewModel {
  menuItems: MenuItem[];
  categories: MenuCategoryRecord[];
  tables: Table[];
  isLoading: boolean;
}

@Component({
  selector: 'app-create-order-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, PageHeaderComponent, ReactiveFormsModule],
  template: `
    <section class="page-surface order-workflow-page">
      <app-page-header
        eyebrow="הזמנה חדשה"
        title="בניית הזמנה"
        subtitle="תפריט, הזמנה נוכחית ופעולות במקום אחד."
      />

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (vm$ | async; as vm) {
        @if (vm.isLoading) {
          <div class="empty-state">
            <h2>טוען תפריט...</h2>
          </div>
        } @else {
          <form class="order-workflow" [formGroup]="form" (ngSubmit)="submit()">
            <section class="panel order-step-panel table-step-panel">
              <div class="workflow-step">
                <span>1</span>
                <div>
                  <h2>בחירת סוג הזמנה ושולחן</h2>
                  <p>בחרו ישיבה במסעדה או איסוף, ואז סמנו שולחן פנוי.</p>
                </div>
              </div>

              <div class="order-meta">
                <div class="segmented-control">
                  <button
                    type="button"
                    [class.active]="form.controls.orderType.value === OrderType.DineIn"
                    (click)="setOrderType(OrderType.DineIn)"
                  >
                    {{ orderTypeLabels[OrderType.DineIn] }}
                  </button>
                  <button
                    type="button"
                    [class.active]="form.controls.orderType.value === OrderType.TakeAway"
                    (click)="setOrderType(OrderType.TakeAway)"
                  >
                    {{ orderTypeLabels[OrderType.TakeAway] }}
                  </button>
                </div>

                <div class="form-grid compact-form-grid">
                  <label>
                    שם פרטי
                    <input formControlName="customerFirstName" />
                    @if (fieldError('customerFirstName')) {
                      <span class="field-error">{{ fieldError('customerFirstName') }}</span>
                    }
                  </label>
                  <label>
                    שם משפחה
                    <input formControlName="customerLastName" />
                    @if (fieldError('customerLastName')) {
                      <span class="field-error">{{ fieldError('customerLastName') }}</span>
                    }
                  </label>
                </div>

                @if (form.controls.orderType.value === OrderType.DineIn) {
                  <div class="table-picker">
                    @for (table of vm.tables; track table.id) {
                      <button
                        type="button"
                        [class.active]="selectedTableIds.has(table.id)"
                        [disabled]="table.status !== TableStatus.Available && !selectedTableIds.has(table.id)"
                        (click)="toggleTable(table)"
                      >
                        <span>{{ table.name }}</span>
                        <small>{{ table.status === TableStatus.Available || selectedTableIds.has(table.id) ? 'פנוי' : 'לא זמין' }}</small>
                      </button>
                    }
                  </div>
                }
              </div>
            </section>

            <section class="panel order-step-panel order-menu-panel">
              <div class="workflow-step">
                <span>2</span>
                <div>
                  <h2>בחירת מנות</h2>
                  <p>חפשו, סננו לפי קטגוריה והוסיפו בלחיצה אחת.</p>
                </div>
              </div>
              <div class="section-heading">
                <label>
                  <span>חיפוש</span>
                  <input
                    #menuSearch
                    type="search"
                    [value]="menuSearchTerm"
                    placeholder="שם מנה"
                    autocomplete="off"
                    (input)="menuSearchTerm = menuSearch.value"
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
                  <button type="button" class="menu-pick" (click)="addItem(item)">
                    <span class="menu-pick__media">
                      @if (primaryImage(item); as imageUrl) {
                        <img [src]="imageUrl" [alt]="item.name" loading="lazy" />
                      } @else {
                        <span class="menu-placeholder" aria-hidden="true"></span>
                      }
                    </span>
                    <span class="menu-pick__content">
                      <small class="menu-category">{{ categoryName(item) }}</small>
                      <strong>{{ item.name }}</strong>
                      <small>{{ item.description }}</small>
                    </span>
                    <span class="menu-pick__action">
                      <em>{{ item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</em>
                      <span>+</span>
                    </span>
                  </button>
                } @empty {
                  <div class="empty-state empty-state--compact">
                    <h2>לא נמצאו מנות</h2>
                  </div>
                }
              </div>
            </section>

            <section class="panel order-step-panel current-order-panel">
              <div class="workflow-step workflow-step--summary">
                <span>3</span>
                <div>
                  <h2>סיכום הזמנה</h2>
                  <p>בדקו כמויות והערות לפני שליחה.</p>
                </div>
                <strong>{{ total | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>

              <div class="summary-total-strip">
                <span>סה"כ פריטים: {{ selectedItemCount }}</span>
                <strong>{{ total | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>

              <div class="current-lines">
                @for (line of cart; track line.item.id) {
                  <article class="current-line">
                    <div>
                      <strong>{{ line.item.name }}</strong>
                      <span>{{ line.item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
                    </div>
                    <div class="line-controls">
                      <button type="button" (click)="decrement(line.item.id)">−</button>
                      <span>{{ line.quantity }}</span>
                      <button type="button" (click)="increment(line.item.id)">+</button>
                      <button type="button" class="line-remove" (click)="removeLine(line.item.id)">הסר</button>
                    </div>
                    <input
                      [value]="line.notes"
                      placeholder="הערה למטבח"
                      (input)="updateLineNotes(line.item.id, $event)"
                    />
                  </article>
                } @empty {
                  <div class="cart-empty">
                    <strong>עדיין אין פריטים</strong>
                    <span>הוסיפו מנות מהתפריט.</span>
                  </div>
                }
              </div>
            </section>

            <aside class="panel order-step-panel order-actions-panel">
              <div class="workflow-step">
                <span>4</span>
                <div>
                  <h2>שליחה</h2>
                  <p>הוסיפו הערה כללית ושלחו לתחנה.</p>
                </div>
              </div>
              <label>
                הערה להזמנה
                <textarea rows="3" formControlName="notes"></textarea>
              </label>
              @if (submitted && cart.length === 0) {
                <p class="validation-note">יש להוסיף לפחות מנה אחת.</p>
              }
              @if (submitted && form.controls.orderType.value === OrderType.DineIn && selectedTableIds.size === 0) {
                <p class="validation-note">יש לבחור שולחן.</p>
              }
              <button class="btn btn-gold full" type="submit" [disabled]="isSubmitting">
                {{ isSubmitting ? 'שולחים...' : 'שליחה לסלטיה' }}
              </button>
            </aside>
          </form>
        }
      }
    </section>
  `,
  styles: [`
    .order-workflow-page {
      width: min(1280px, calc(100% - 32px));
      display: grid;
      gap: 1.35rem;
    }

    .order-workflow {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.35rem;
    }

    .order-step-panel {
      display: grid;
      gap: 1.15rem;
      align-content: start;
      overflow: hidden;
      border-color: rgba(61, 37, 25, 0.12);
      background:
        linear-gradient(180deg, rgba(255, 250, 242, 0.96), rgba(255, 248, 237, 0.84)),
        rgba(255, 248, 237, 0.9);
      box-shadow: 0 12px 30px rgba(31, 21, 17, 0.07);
    }

    .table-step-panel {
      background:
        linear-gradient(135deg, rgba(199, 154, 59, 0.14), rgba(102, 112, 68, 0.08)),
        rgba(255, 248, 237, 0.93);
    }

    .workflow-step {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 0.9rem;
      align-items: start;
    }

    .workflow-step > span {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid rgba(141, 101, 29, 0.22);
      background: linear-gradient(135deg, var(--gold), #e5bf68);
      color: var(--brown-950);
      font-weight: 950;
      box-shadow: 0 8px 18px rgba(199, 154, 59, 0.22);
    }

    .workflow-step h2,
    .workflow-step p {
      margin: 0;
    }

    .workflow-step p {
      color: var(--muted);
      font-weight: 800;
    }

    .workflow-step--summary {
      grid-template-columns: 42px minmax(0, 1fr) auto;
    }

    .workflow-step--summary > strong {
      color: var(--burgundy);
      font-size: 1.45rem;
      white-space: nowrap;
    }

    .summary-total-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: var(--radius);
      background: var(--brown-950);
      color: var(--ivory);
    }

    .summary-total-strip span {
      color: rgba(255, 248, 237, 0.78);
      font-weight: 850;
    }

    .summary-total-strip strong {
      color: var(--ivory);
      font-size: 1.35rem;
      white-space: nowrap;
    }

    .section-heading {
      display: flex;
      justify-content: flex-start;
      align-items: end;
      gap: 1rem;
    }

    .section-heading h2 {
      margin: 0;
    }

    .section-heading label {
      width: min(430px, 100%);
      max-width: none;
    }

    .category-tabs,
    .table-picker {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .category-tabs {
      padding: 0.35rem;
      border: 1px solid rgba(61, 37, 25, 0.1);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.62);
    }

    .table-picker {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      max-height: min(380px, 36vh);
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.15rem;
      scrollbar-gutter: stable;
    }

    .category-tabs button,
    .table-picker button {
      min-height: 48px;
      padding: 0.55rem 0.85rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.76);
      color: var(--brown-950);
      font: inherit;
      font-weight: 900;
      cursor: pointer;
    }

    .category-tabs button {
      border-color: transparent;
      background: transparent;
    }

    .table-picker button {
      display: grid;
      gap: 0.15rem;
      min-height: 64px;
      border-radius: var(--radius);
      text-align: start;
      background: rgba(255, 250, 242, 0.86);
    }

    .table-picker small {
      color: var(--muted);
      font-weight: 800;
    }

    .table-picker button.active small {
      color: rgba(255, 248, 237, 0.8);
    }

    .category-tabs button.active,
    .table-picker button.active {
      border-color: var(--brown-950);
      background: var(--brown-950);
      color: var(--ivory);
    }

    .table-picker button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .menu-pick-list,
    .current-lines {
      display: grid;
      gap: 0.9rem;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.1rem;
      scrollbar-gutter: stable;
    }

    .menu-pick-list {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
      max-height: min(760px, 64vh);
    }

    .current-lines {
      max-height: min(640px, 56vh);
    }

    .menu-pick {
      position: relative;
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 0.9rem;
      align-items: stretch;
      min-height: 154px;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 250, 242, 0.9);
      color: var(--brown-950);
      text-align: start;
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }

    .menu-pick:hover {
      border-color: rgba(199, 154, 59, 0.46);
      box-shadow: 0 12px 28px rgba(31, 21, 17, 0.1);
      transform: translateY(-1px);
    }

    .menu-pick__media {
      overflow: hidden;
      border-radius: var(--radius);
      background:
        linear-gradient(135deg, rgba(199, 154, 59, 0.18), rgba(102, 112, 68, 0.12)),
        var(--beige);
    }

    .menu-pick__media img,
    .menu-placeholder {
      width: 100%;
      height: 100%;
      min-height: 122px;
      object-fit: cover;
    }

    .menu-placeholder {
      position: relative;
      display: block;
    }

    .menu-placeholder::before,
    .menu-placeholder::after {
      content: "";
      position: absolute;
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      border-radius: 999px;
    }

    .menu-placeholder::before {
      width: 42px;
      height: 42px;
      border: 2px solid rgba(61, 37, 25, 0.18);
      background: rgba(255, 248, 237, 0.62);
    }

    .menu-placeholder::after {
      width: 16px;
      height: 16px;
      background: rgba(199, 154, 59, 0.58);
      box-shadow: 18px 0 0 rgba(102, 112, 68, 0.42), -18px 0 0 rgba(124, 38, 48, 0.28);
    }

    .menu-pick__content {
      align-content: start;
      padding-bottom: 2.6rem;
    }

    .menu-category {
      justify-self: start;
      min-height: 24px;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      background: rgba(199, 154, 59, 0.16);
      color: var(--gold-dark) !important;
      font-size: 0.78rem;
    }

    .menu-pick__action {
      position: absolute;
      inset-inline: 1rem;
      bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .menu-pick__action > span {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--brown-950);
      color: var(--ivory);
      font-size: 1.2rem;
      font-weight: 950;
    }

    .menu-pick__content,
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
    .current-line span {
      color: var(--muted);
      font-weight: 800;
    }

    .menu-pick em {
      font-style: normal;
      font-weight: 950;
    }

    .order-meta {
      display: grid;
      gap: 1rem;
    }

    .order-meta .segmented-control {
      margin-bottom: 0;
    }

    .compact-form-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .current-line {
      display: grid;
      gap: 0.75rem;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 250, 242, 0.88);
    }

    .line-controls {
      display: grid;
      grid-template-columns: 48px 48px 48px minmax(82px, auto);
      gap: 0.4rem;
      align-items: center;
    }

    .line-controls button,
    .line-controls span {
      display: grid;
      place-items: center;
      min-height: 44px;
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

    .line-remove {
      color: var(--danger) !important;
    }

    .cart-empty {
      display: grid;
      place-items: center;
      gap: 0.25rem;
      min-height: 120px;
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      color: var(--muted);
      text-align: center;
      background: rgba(255, 250, 242, 0.58);
    }

    .order-actions-panel {
      z-index: 2;
      max-width: 820px;
      width: 100%;
      justify-self: center;
    }

    .order-actions-panel h2 {
      margin: 0;
    }

    .order-actions-panel button {
      min-height: 52px;
    }

    @media (min-width: 1280px) {
      .order-meta {
        grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1fr);
        align-items: start;
      }

      .table-picker {
        grid-column: 1 / -1;
        max-height: min(320px, 34vh);
      }

      .order-workflow {
        grid-template-columns: minmax(0, 1fr) minmax(340px, 390px);
        align-items: start;
        column-gap: 1.5rem;
      }

      .table-step-panel {
        grid-column: 1 / -1;
      }

      .current-order-panel {
        position: sticky;
        top: 92px;
      }

      .order-actions-panel {
        grid-column: 1 / -1;
        position: static;
      }
    }

    @media (max-width: 680px) {
      .section-heading,
      .compact-form-grid {
        grid-template-columns: 1fr;
      }

      .workflow-step,
      .workflow-step--summary {
        grid-template-columns: 38px minmax(0, 1fr);
      }

      .workflow-step > span {
        width: 38px;
        height: 38px;
      }

      .workflow-step--summary > strong {
        grid-column: 2;
      }

      .summary-total-strip {
        align-items: flex-start;
        flex-direction: column;
      }

      .section-heading {
        display: grid;
      }

      .section-heading label {
        max-width: none;
      }

      .table-picker {
        max-height: min(340px, 40vh);
      }

      .menu-pick-list {
        max-height: min(680px, 62vh);
      }

      .current-lines {
        max-height: min(620px, 58vh);
      }

      .menu-pick {
        grid-template-columns: 88px minmax(0, 1fr);
        min-height: 132px;
        padding: 0.85rem;
      }

      .menu-pick__media img,
      .menu-placeholder {
        min-height: 104px;
      }

      .menu-pick__action {
        inset-inline: 0.85rem;
        bottom: 0.85rem;
      }

      .line-controls {
        grid-template-columns: 46px 46px 46px minmax(68px, 1fr);
      }
    }
  `]
})
export class CreateOrderPageComponent implements OnInit {
  private readonly data = inject(RestaurantDataService);
  private readonly auth = inject(AuthService);
  private readonly feedback = inject(FeedbackService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly OrderType = OrderType;
  readonly TableStatus = TableStatus;
  readonly orderTypeLabels = orderTypeLabels;
  readonly vm$ = combineLatest([
    this.data.getAvailableMenuItems(),
    this.data.getMenuCategories(),
    this.data.getTables()
  ]).pipe(
    tap(([, , tables]) => this.reconcileSelectedTables(tables)),
    map(([menuItems, categories, tables]) => ({ menuItems, categories, tables, isLoading: false })),
    catchError((error) => {
      this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לטעון את נתוני ההזמנה.');
      this.feedback.error(error, this.errorMessage);
      return of({ menuItems: [], categories: [], tables: [], isLoading: false });
    }),
    startWith({ menuItems: [], categories: [], tables: [], isLoading: true })
  );

  readonly form = this.fb.nonNullable.group({
    orderType: [OrderType.DineIn, Validators.required],
    customerFirstName: ['אורח', Validators.required],
    customerLastName: ['מסעדה', Validators.required],
    notes: ['']
  });

  selectedTableIds = new Set<number>();
  selectedCategoryId: number | 'all' = 'all';
  menuSearchTerm = '';
  cart: CartLine[] = [];
  isSubmitting = false;
  submitted = false;
  errorMessage = '';
  orderDetailsBaseLink = '/waiter/orders';
  private readonly defaultMenuImageUrl = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1';

  ngOnInit(): void {
    this.orderDetailsBaseLink = this.isInsideRoute('admin') ? '/admin/orders' : '/waiter/orders';
    const tableId = Number(this.route.snapshot.queryParamMap.get('tableId'));
    if (Number.isFinite(tableId) && tableId > 0) {
      this.selectedTableIds = new Set([tableId]);
      this.form.controls.orderType.setValue(OrderType.DineIn);
    }
  }

  get total(): number {
    return this.cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  }

  get selectedItemCount(): number {
    return this.cart.reduce((sum, line) => sum + line.quantity, 0);
  }

  get canSubmit(): boolean {
    const requiresTable = this.form.controls.orderType.value === OrderType.DineIn;
    return !this.isSubmitting && this.form.valid && this.cart.length > 0 && (!requiresTable || this.selectedTableIds.size > 0);
  }

  setOrderType(orderType: OrderType): void {
    this.form.controls.orderType.setValue(orderType);
    if (orderType === OrderType.TakeAway) {
      this.selectedTableIds = new Set();
    }
  }

  toggleTable(table: Table): void {
    const next = new Set(this.selectedTableIds);
    if (next.has(table.id)) {
      next.delete(table.id);
    } else if (table.status === TableStatus.Available) {
      next.clear();
      next.add(table.id);
    }
    this.selectedTableIds = next;
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

  primaryImage(item: MenuItem): string {
    const imageUrl = item.imageItems?.find((image) => image.isMainImage)?.imageUrl || item.images?.[0] || '';
    return imageUrl.startsWith(this.defaultMenuImageUrl) ? '' : imageUrl;
  }

  categoryName(item: MenuItem): string {
    return item.categoryName || `קטגוריה ${item.category}`;
  }

  addItem(item: MenuItem): void {
    const existing = this.cart.find((line) => line.item.id === item.id);
    if (existing) {
      this.increment(item.id);
      return;
    }

    this.cart = [...this.cart, { item, quantity: 1, notes: '' }];
  }

  increment(itemId: number): void {
    this.cart = this.cart.map((line) =>
      line.item.id === itemId ? { ...line, quantity: line.quantity + 1 } : line
    );
  }

  decrement(itemId: number): void {
    this.cart = this.cart
      .map((line) => line.item.id === itemId ? { ...line, quantity: line.quantity - 1 } : line)
      .filter((line) => line.quantity > 0);
  }

  removeLine(itemId: number): void {
    this.cart = this.cart.filter((line) => line.item.id !== itemId);
  }

  updateLineNotes(itemId: number, event: Event): void {
    const notes = (event.target as HTMLInputElement | null)?.value ?? '';
    this.cart = this.cart.map((line) => line.item.id === itemId ? { ...line, notes } : line);
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.canSubmit) {
      this.submitted = true;
      this.form.markAllAsTouched();
      this.errorMessage = this.createSubmitErrorMessage();
      this.feedback.error(null, this.errorMessage);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.data.createOrder({
      userId: this.auth.currentUser?.id ?? null,
      customerFirstName: this.form.controls.customerFirstName.value,
      customerLastName: this.form.controls.customerLastName.value,
      notes: this.form.controls.notes.value,
      orderType: this.form.controls.orderType.value,
      tableIds: [...this.selectedTableIds],
      items: this.cart.map((line) => ({
        menuItemId: line.item.id,
        quantity: line.quantity,
        notes: line.notes
      }))
    }).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: (order) => {
        this.feedback.success();
        void this.router.navigate([this.orderDetailsBaseLink, order.id]);
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לפתוח את ההזמנה.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.submitted);
  }

  private isInsideRoute(path: string): boolean {
    return this.route.snapshot.pathFromRoot.some((snapshot) => snapshot.routeConfig?.path === path);
  }

  private reconcileSelectedTables(tables: Table[]): void {
    if (this.form.controls.orderType.value !== OrderType.DineIn || this.selectedTableIds.size === 0) {
      return;
    }

    const availableTableIds = new Set(
      tables
        .filter((table) => table.status === TableStatus.Available)
        .map((table) => table.id)
    );
    const nextSelection = [...this.selectedTableIds].filter((tableId) => availableTableIds.has(tableId));

    if (nextSelection.length !== this.selectedTableIds.size) {
      this.selectedTableIds = new Set(nextSelection);
    }
  }

  private createSubmitErrorMessage(): string {
    if (this.cart.length === 0) {
      return 'יש להוסיף לפחות מנה אחת.';
    }

    if (this.form.controls.orderType.value === OrderType.DineIn && this.selectedTableIds.size === 0) {
      return 'יש לבחור שולחן.';
    }

    return 'בדקו את פרטי ההזמנה ונסו שוב.';
  }
}
