import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { MenuItem, OrderType, Table, TableStatus } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { MenuItemCardComponent } from '../../shared/components/menu-item-card.component';
import { controlError } from '../../shared/form-validation';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TableCardComponent } from '../../shared/components/table-card.component';
import { orderTypeLabels } from '../../shared/ui-labels';

interface CartLine {
  item: MenuItem;
  quantity: number;
  notes: string;
}

@Component({
  selector: 'app-create-order-page',
  standalone: true,
  imports: [
    AsyncPipe,
    CurrencyPipe,
    MenuItemCardComponent,
    PageHeaderComponent,
    ReactiveFormsModule,
    TableCardComponent
  ],
  template: `
    <section class="page-surface create-order-page">
      <app-page-header
        eyebrow="פתיחת הזמנה"
        title="הזמנה חדשה"
        subtitle="בחירה מהירה של סוג הזמנה, שולחן, מנות וסיכום לפני שליחה למטבח."
      />

      <form class="order-builder create-order-layout" [formGroup]="form" (ngSubmit)="submit()">
        <div class="order-builder__main create-order-main">
          <section class="panel create-order-step">
            <div class="step-heading">
              <span>1</span>
              <div>
                <h2>פרטי הזמנה</h2>
                <p>בחרו סוג הזמנה והכניסו שם לקוח קצר לזיהוי מהיר.</p>
              </div>
            </div>

            <div class="segmented-control waiter-segmented">
              <button
                type="button"
                [class.active]="form.controls.orderType.value === OrderType.DineIn"
                (click)="form.controls.orderType.setValue(OrderType.DineIn)"
              >
                {{ orderTypeLabels[OrderType.DineIn] }}
              </button>
              <button
                type="button"
                [class.active]="form.controls.orderType.value === OrderType.TakeAway"
                (click)="form.controls.orderType.setValue(OrderType.TakeAway)"
              >
                {{ orderTypeLabels[OrderType.TakeAway] }}
              </button>
            </div>

            <div class="form-grid waiter-form-grid">
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
              <label class="full">
                הערות להזמנה
                <textarea rows="3" formControlName="notes" placeholder="לדוגמה: אלרגיה, סדר הגשה, בקשה מהמטבח"></textarea>
              </label>
            </div>
          </section>

          @if (form.controls.orderType.value === OrderType.DineIn) {
            <section class="panel create-order-step">
              <div class="step-heading">
                <span>2</span>
                <div>
                  <h2>בחירת שולחן</h2>
                  <p>{{ selectedTableIds.size ? selectedTableIds.size + ' שולחנות נבחרו' : 'בחרו שולחן פנוי להזמנה במסעדה.' }}</p>
                </div>
              </div>

              <div class="table-grid waiter-table-grid">
                @for (table of tables$ | async; track table.id) {
                  <app-table-card
                    [table]="table"
                    [selectable]="table.status === TableStatus.Available || selectedTableIds.has(table.id)"
                    [selected]="selectedTableIds.has(table.id)"
                    (select)="toggleTable(table)"
                  />
                }
              </div>
            </section>
          }

          <section class="panel create-order-step">
            <div class="step-heading">
              <span>{{ form.controls.orderType.value === OrderType.DineIn ? '3' : '2' }}</span>
              <div>
                <h2>הוספת מנות</h2>
                <p>הוסיפו מנות לעגלה. הכמויות וההערות נשמרות בסיכום.</p>
              </div>
            </div>

            <label class="dish-search">
              חיפוש מנה
              <input
                #menuSearch
                type="search"
                [value]="menuSearchTerm"
                placeholder="חיפוש לפי שם מנה או תיאור"
                autocomplete="off"
                (input)="menuSearchTerm = menuSearch.value"
              />
            </label>

            @if (menuItems$ | async; as menuItems) {
              @if (filteredMenuItems(menuItems); as visibleMenuItems) {
                <div class="menu-grid menu-grid--compact waiter-menu-grid">
                  @for (item of visibleMenuItems; track item.id) {
                    <app-menu-item-card [item]="item" [showAdd]="true" (add)="addItem(item)" />
                  }
                </div>

                @if (!visibleMenuItems.length) {
                  <div class="empty-state empty-state--compact">
                    <h2>לא נמצאו מנות מתאימות</h2>
                  </div>
                }
              }
            }
          </section>
        </div>

        <aside class="order-summary waiter-order-summary">
          <div class="summary-top">
            <p class="eyebrow">סיכום הזמנה</p>
            <h2>{{ total | currency: 'ILS' : 'symbol' : '1.0-0' }}</h2>
            <span>{{ cart.length }} מנות בעגלה</span>
          </div>

          <div class="cart-lines waiter-cart-lines">
            @for (line of cart; track line.item.id) {
              <div class="cart-line waiter-cart-line">
                <div class="cart-line__details">
                  <strong>{{ line.item.name }}</strong>
                  <span>{{ line.item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
                </div>
                <div class="stepper waiter-stepper">
                  <button type="button" aria-label="הפחתת כמות" (click)="decrement(line.item.id)">−</button>
                  <span>{{ line.quantity }}</span>
                  <button type="button" aria-label="הגדלת כמות" (click)="increment(line.item.id)">+</button>
                </div>
                <label class="cart-line__note">
                  הערה למנה
                  <input
                    [value]="line.notes"
                    placeholder="ללא בצל, רוטב בצד..."
                    (input)="updateLineNotes(line.item.id, $event)"
                  />
                </label>
              </div>
            } @empty {
              <div class="cart-empty">
                <strong>העגלה ריקה</strong>
                <span>הוסיפו מנה אחת לפחות כדי לשלוח למטבח.</span>
              </div>
            }
          </div>

          @if (errorMessage) {
            <p class="validation-note full">{{ errorMessage }}</p>
          }
          @if (submitted && cart.length === 0) {
            <p class="validation-note full">יש להוסיף לפחות מנה אחת להזמנה.</p>
          }
          @if (submitted && form.controls.orderType.value === OrderType.DineIn && selectedTableIds.size === 0) {
            <p class="validation-note full">יש לבחור שולחן להזמנה במסעדה.</p>
          }

          <button class="btn btn-gold full waiter-submit" type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? 'שולחים...' : 'שליחת הזמנה למטבח' }}
          </button>
        </aside>
      </form>
    </section>
  `,
  styles: [`
    .create-order-page {
      display: grid;
      gap: 1rem;
    }

    .create-order-layout {
      grid-template-columns: minmax(0, 1fr) minmax(320px, 390px);
      align-items: start;
      gap: 18px;
    }

    .create-order-main {
      gap: 18px;
    }

    .create-order-step {
      display: grid;
      gap: 1rem;
    }

    .step-heading {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
    }

    .step-heading > span {
      flex: 0 0 auto;
      display: inline-grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: var(--brown-950);
      color: var(--ivory);
      font-weight: 950;
    }

    .step-heading h2,
    .step-heading p {
      margin: 0;
    }

    .step-heading p {
      color: var(--muted);
      font-weight: 750;
    }

    .waiter-segmented {
      margin-bottom: 0;
    }

    .waiter-segmented button,
    .waiter-submit,
    .waiter-stepper button {
      min-height: 46px;
    }

    .dish-search input,
    .waiter-form-grid input,
    .waiter-form-grid textarea,
    .cart-line__note input {
      min-height: 48px;
    }

    .dish-search {
      max-width: 420px;
    }

    .waiter-table-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .waiter-menu-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .waiter-order-summary {
      position: sticky;
      top: 92px;
      display: grid;
      gap: 1rem;
      max-height: calc(100vh - 116px);
      overflow: auto;
    }

    .summary-top {
      display: grid;
      gap: 0.25rem;
    }

    .summary-top h2 {
      margin: 0;
      color: var(--brown-950);
      font-size: 2rem;
    }

    .summary-top span {
      color: var(--muted);
      font-weight: 850;
    }

    .waiter-cart-lines {
      gap: 0.85rem;
    }

    .waiter-cart-line {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.7rem;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.62);
    }

    .cart-line__details {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }

    .cart-line__details strong {
      color: var(--brown-950);
      overflow-wrap: anywhere;
    }

    .cart-line__details span {
      color: var(--muted);
      font-weight: 850;
    }

    .cart-line__note {
      grid-column: 1 / -1;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .cart-empty {
      display: grid;
      gap: 0.25rem;
      min-height: 120px;
      place-items: center;
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      color: var(--muted);
      text-align: center;
    }

    .cart-empty strong {
      color: var(--brown-950);
    }

    @media (max-width: 1060px) {
      .create-order-layout {
        grid-template-columns: 1fr;
      }

      .waiter-order-summary {
        position: static;
        max-height: none;
      }
    }

    @media (max-width: 680px) {
      .waiter-form-grid,
      .waiter-table-grid,
      .waiter-menu-grid,
      .waiter-cart-line {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CreateOrderPageComponent implements OnInit {
  private readonly data = inject(RestaurantDataService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly OrderType = OrderType;
  readonly TableStatus = TableStatus;
  readonly orderTypeLabels = orderTypeLabels;
  readonly menuItems$ = this.data.getAvailableMenuItems();
  readonly tables$ = this.data.getTables();

  readonly form = this.fb.nonNullable.group({
    orderType: [OrderType.DineIn, Validators.required],
    customerFirstName: ['אורח', Validators.required],
    customerLastName: ['מסעדה', Validators.required],
    notes: ['']
  });

  selectedTableIds = new Set<number>();
  cart: CartLine[] = [];
  isSubmitting = false;
  errorMessage = '';
  orderDetailsBaseLink = '/waiter/orders';
  submitted = false;
  menuSearchTerm = '';

  ngOnInit(): void {
    this.orderDetailsBaseLink = this.isInsideRoute('admin') ? '/admin/orders' : '/waiter/orders';
  }

  get total(): number {
    return this.cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  }

  get canSubmit(): boolean {
    const requiresTable = this.form.controls.orderType.value === OrderType.DineIn;
    return !this.isSubmitting && this.form.valid && this.cart.length > 0 && (!requiresTable || this.selectedTableIds.size > 0);
  }

  toggleTable(table: Table): void {
    const next = new Set(this.selectedTableIds);
    if (next.has(table.id)) {
      next.delete(table.id);
    } else if (table.status === TableStatus.Available) {
      next.add(table.id);
    }
    this.selectedTableIds = next;
  }

  filteredMenuItems(items: MenuItem[]): MenuItem[] {
    const search = this.menuSearchTerm.trim().toLowerCase();
    if (!search) {
      return items;
    }

    return items.filter((item) =>
      item.name.toLowerCase().includes(search) ||
      item.description.toLowerCase().includes(search)
    );
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
      .map((line) => (line.item.id === itemId ? { ...line, quantity: line.quantity - 1 } : line))
      .filter((line) => line.quantity > 0);
  }

  updateLineNotes(itemId: number, event: Event): void {
    const notes = (event.target as HTMLInputElement | null)?.value ?? '';
    this.cart = this.cart.map((line) => line.item.id === itemId ? { ...line, notes } : line);
  }

  private isInsideRoute(path: string): boolean {
    return this.route.snapshot.pathFromRoot.some((snapshot) => snapshot.routeConfig?.path === path);
  }

  submit(): void {
    if (!this.canSubmit) {
      this.submitted = true;
      this.form.markAllAsTouched();
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
      next: (order) => void this.router.navigate([this.orderDetailsBaseLink, order.id]),
      error: () => {
        this.errorMessage = 'לא הצלחנו לפתוח את ההזמנה. נסו שוב בעוד רגע.';
      }
    });
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.submitted);
  }
}
