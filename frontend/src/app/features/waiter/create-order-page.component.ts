import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { MenuItem, OrderType, Table, TableStatus } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { MenuItemCardComponent } from '../../shared/components/menu-item-card.component';
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
    <section class="page-surface">
      <app-page-header
        eyebrow="פתיחת הזמנה"
        title="זרימת הזמנה מהירה"
        subtitle="בחירת סוג הזמנה, שולחן, מנות וסיכום תשלום ראשוני."
      />

      <form class="order-builder" [formGroup]="form" (ngSubmit)="submit()">
        <div class="order-builder__main">
          <section class="panel">
            <h2>סוג הזמנה</h2>
            <div class="segmented-control">
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
            <div class="form-grid">
              <label>
                שם פרטי
                <input formControlName="customerFirstName" />
              </label>
              <label>
                שם משפחה
                <input formControlName="customerLastName" />
              </label>
              <label class="full">
                הערות להזמנה
                <textarea rows="3" formControlName="notes"></textarea>
              </label>
            </div>
          </section>

          @if (form.controls.orderType.value === OrderType.DineIn) {
            <section class="panel">
              <h2>בחירת שולחן</h2>
              <div class="table-grid">
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

          <section class="panel">
            <h2>הוספת מנות</h2>
            <div class="menu-grid menu-grid--compact">
              @for (item of menuItems$ | async; track item.id) {
                <app-menu-item-card [item]="item" [showAdd]="true" (add)="addItem(item)" />
              }
            </div>
          </section>
        </div>

        <aside class="order-summary">
          <p class="eyebrow">סיכום הזמנה</p>
          <h2>{{ total | currency: 'ILS' : 'symbol' : '1.0-0' }}</h2>
          <div class="cart-lines">
            @for (line of cart; track line.item.id) {
              <div class="cart-line">
                <div>
                  <strong>{{ line.item.name }}</strong>
                  <span>{{ line.item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
                </div>
                <div class="stepper">
                  <button type="button" (click)="decrement(line.item.id)">−</button>
                  <span>{{ line.quantity }}</span>
                  <button type="button" (click)="increment(line.item.id)">+</button>
                </div>
              </div>
            } @empty {
              <p class="muted">עוד לא נוספו מנות.</p>
            }
          </div>
          @if (errorMessage) {
            <p class="validation-note full">{{ errorMessage }}</p>
          }
          <button class="btn btn-gold full" type="submit" [disabled]="!canSubmit">
            {{ isSubmitting ? 'שולחים...' : 'שליחת הזמנה למטבח' }}
          </button>
        </aside>
      </form>
    </section>
  `
})
export class CreateOrderPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

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

  submit(): void {
    if (!this.canSubmit) {
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
      next: (order) => void this.router.navigate(['/waiter/orders', order.id]),
      error: () => {
        this.errorMessage = 'לא הצלחנו לפתוח את ההזמנה. נסו שוב בעוד רגע.';
      }
    });
  }
}
