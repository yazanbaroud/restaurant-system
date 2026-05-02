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
            <section class="panel order-menu-panel">
              <div class="section-heading">
                <h2>תפריט</h2>
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
                <h2>הזמנה נוכחית</h2>
                <strong>{{ total | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
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
                        {{ table.name }}
                      </button>
                    }
                  </div>
                }
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

            <aside class="panel order-actions-panel">
              <h2>פעולות</h2>
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
      display: grid;
      gap: 1rem;
    }

    .order-workflow {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
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
      justify-content: space-between;
      align-items: end;
      gap: 1rem;
    }

    .section-heading h2 {
      margin: 0;
    }

    .section-heading label {
      max-width: 280px;
    }

    .category-tabs,
    .table-picker {
      display: flex;
      gap: 0.45rem;
      overflow-x: auto;
      padding-bottom: 0.2rem;
    }

    .category-tabs button,
    .table-picker button {
      flex: 0 0 auto;
      min-height: 42px;
      padding: 0.55rem 0.85rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 248, 237, 0.76);
      color: var(--brown-950);
      font: inherit;
      font-weight: 900;
      cursor: pointer;
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
      gap: 0.65rem;
    }

    .menu-pick {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.75rem;
      align-items: center;
      min-height: 76px;
      padding: 0.85rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.68);
      color: var(--brown-950);
      text-align: start;
      cursor: pointer;
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
      gap: 0.85rem;
    }

    .compact-form-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .current-line {
      display: grid;
      gap: 0.65rem;
      padding: 0.85rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.68);
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

    .line-remove {
      color: var(--danger) !important;
    }

    .cart-empty {
      display: grid;
      place-items: center;
      min-height: 120px;
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      color: var(--muted);
      text-align: center;
    }

    .order-actions-panel {
      position: sticky;
      bottom: 0;
      z-index: 2;
    }

    .order-actions-panel h2 {
      margin: 0;
    }

    .order-actions-panel button {
      min-height: 52px;
    }

    @media (min-width: 980px) {
      .order-workflow {
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
        align-items: start;
      }

      .order-actions-panel {
        grid-column: 1 / -1;
        position: static;
      }
    }

    @media (min-width: 1220px) {
      .order-workflow {
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr) 280px;
      }

      .order-actions-panel {
        grid-column: auto;
        position: sticky;
        top: 92px;
      }
    }

    @media (max-width: 680px) {
      .section-heading,
      .compact-form-grid {
        grid-template-columns: 1fr;
      }

      .section-heading {
        display: grid;
      }

      .section-heading label {
        max-width: none;
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
