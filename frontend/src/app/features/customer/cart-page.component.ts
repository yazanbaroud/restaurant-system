import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { CustomerCartLine, CustomerCartService } from '../../core/services/customer-cart.service';
import { CustomerOrdersService } from '../../core/services/customer-orders.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { OrderType } from '../../core/models';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { orderTypeLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, FormsModule, PageHeaderComponent, RouterLink],
  template: `
    <section class="page-surface customer-cart-page">
      <app-page-header
        eyebrow="עגלה"
        title="ההזמנה שלי"
        subtitle="בדקו כמויות, הוסיפו הערות למנות ובחרו איך תרצו לקבל את ההזמנה."
      >
        <a class="btn btn-ghost" routerLink="/menu">הוספת מנות נוספות</a>
      </app-page-header>

      @if (cart.lines$ | async; as lines) {
        @if (lines.length) {
          <form class="customer-cart-layout" (ngSubmit)="submit(lines)">
            <div class="customer-cart-main">
              <section class="panel customer-cart-section">
                <div class="section-heading-tight">
                  <h2>מנות בעגלה</h2>
                  <span>{{ itemCount(lines) }} פריטים</span>
                </div>

                <div class="customer-cart-lines">
                  @for (line of lines; track line.item.id) {
                    <article class="customer-cart-line">
                      <img [src]="line.item.images[0]" [alt]="line.item.name" />
                      <div class="customer-cart-line__content">
                        <div class="inline-between">
                          <div>
                            <h3>{{ line.item.name }}</h3>
                            <span class="muted">{{ line.item.price | currency: 'ILS' : 'symbol' : '1.0-0' }} למנה</span>
                          </div>
                          <strong class="price">{{ line.item.price * line.quantity | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                        </div>

                        <div class="customer-cart-line__actions">
                          <div class="customer-stepper" aria-label="כמות">
                            <button type="button" aria-label="הפחתת כמות" (click)="updateQuantity(line, line.quantity - 1)">−</button>
                            <span>{{ line.quantity }}</span>
                            <button type="button" aria-label="הגדלת כמות" (click)="updateQuantity(line, line.quantity + 1)">+</button>
                          </div>
                          <button type="button" class="btn btn-small btn-ghost" (click)="remove(line)">הסרה</button>
                        </div>

                        <label>
                          הערה למנה
                          <input
                            [value]="line.notes"
                            placeholder="לדוגמה: בלי בצל, רוטב בצד"
                            (input)="updateNotes(line, $event)"
                          />
                        </label>
                      </div>
                    </article>
                  }
                </div>
              </section>

              <section class="panel customer-cart-section">
                <h2>סוג הזמנה</h2>
                <div class="segmented-control customer-order-type">
                  <button
                    type="button"
                    [class.active]="orderType === OrderType.TakeAway"
                    (click)="setOrderType(OrderType.TakeAway)"
                  >
                    {{ orderTypeLabels[OrderType.TakeAway] }}
                  </button>
                  <button
                    type="button"
                    [class.active]="orderType === OrderType.DineIn"
                    (click)="setOrderType(OrderType.DineIn)"
                  >
                    {{ orderTypeLabels[OrderType.DineIn] }}
                  </button>
                </div>

                @if (orderType === OrderType.DineIn) {
                  <label>
                    שולחן
                    <select #tableSelect [value]="selectedTableId ?? ''" (change)="setSelectedTable(tableSelect.value)">
                      <option value="">בחרו שולחן פנוי</option>
                      @for (table of availableTables$ | async; track table.id) {
                        <option [value]="table.id">{{ table.name }} · עד {{ table.capacity }} סועדים</option>
                      }
                    </select>
                  </label>
                }

                <label>
                  הערות להזמנה
                  <textarea
                    rows="3"
                    [value]="notes"
                    placeholder="בקשות כלליות לצוות"
                    (input)="updateOrderNotes($event)"
                  ></textarea>
                </label>
              </section>
            </div>

            <aside class="order-summary customer-cart-summary">
              <p class="eyebrow">סיכום</p>
              <h2>{{ total(lines) | currency: 'ILS' : 'symbol' : '1.0-0' }}</h2>
              <span>{{ itemCount(lines) }} פריטים</span>
              @if (errorMessage) {
                <p class="validation-note">{{ errorMessage }}</p>
              }
              <button class="btn btn-gold full" type="submit" [disabled]="isSubmitting">
                {{ isSubmitting ? 'שולחים הזמנה...' : 'שליחת הזמנה' }}
              </button>
              <a class="btn btn-ghost full" routerLink="/menu">הוספת מנות נוספות</a>
            </aside>
          </form>
        } @else {
          <div class="empty-state">
            <h2>העגלה ריקה</h2>
            <p class="muted">בחרו מנות מהתפריט כדי להתחיל הזמנה.</p>
            <a class="btn btn-gold" routerLink="/menu">מעבר לתפריט</a>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .customer-cart-page {
      display: grid;
      gap: 1rem;
    }

    .customer-cart-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
      align-items: start;
      gap: 18px;
    }

    .customer-cart-main,
    .customer-cart-section,
    .customer-cart-lines {
      display: grid;
      gap: 1rem;
    }

    .section-heading-tight {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .section-heading-tight h2,
    .section-heading-tight span {
      margin: 0;
    }

    .section-heading-tight span {
      color: var(--muted);
      font-weight: 850;
    }

    .customer-cart-line {
      display: grid;
      grid-template-columns: 132px minmax(0, 1fr);
      gap: 1rem;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.68);
    }

    .customer-cart-line img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: var(--radius);
      background: var(--beige);
    }

    .customer-cart-line__content {
      display: grid;
      gap: 0.85rem;
      min-width: 0;
    }

    .customer-cart-line__content h3 {
      margin: 0 0 0.2rem;
    }

    .customer-cart-line__actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .customer-stepper {
      display: inline-grid;
      grid-template-columns: 42px 44px 42px;
      align-items: center;
      justify-items: center;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.54);
    }

    .customer-stepper button {
      width: 42px;
      height: 42px;
      border: 0;
      background: rgba(31, 21, 17, 0.08);
      color: var(--brown-950);
      cursor: pointer;
      font-weight: 950;
    }

    .customer-stepper span {
      color: var(--brown-950);
      font-weight: 900;
    }

    .customer-order-type {
      margin-bottom: 0;
    }

    .customer-cart-summary {
      display: grid;
      gap: 0.75rem;
    }

    .customer-cart-summary h2 {
      margin: 0;
      color: var(--ivory);
      font-size: 2.1rem;
    }

    .customer-cart-summary span {
      color: rgba(255, 248, 237, 0.76);
      font-weight: 850;
    }

    @media (max-width: 980px) {
      .customer-cart-layout {
        grid-template-columns: 1fr;
      }

      .customer-cart-summary {
        position: static;
      }
    }

    @media (max-width: 640px) {
      .customer-cart-line {
        grid-template-columns: 1fr;
      }

      .customer-cart-line img {
        aspect-ratio: 16 / 9;
      }
    }
  `]
})
export class CartPageComponent {
  readonly cart = inject(CustomerCartService);
  private readonly customerOrders = inject(CustomerOrdersService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly OrderType = OrderType;
  readonly orderTypeLabels = orderTypeLabels;
  readonly availableTables$ = this.customerOrders.getAvailableTables();

  orderType = OrderType.TakeAway;
  selectedTableId: number | null = null;
  notes = '';
  isSubmitting = false;
  errorMessage = '';

  total(lines: CustomerCartLine[]): number {
    return this.cart.totalFor(lines);
  }

  itemCount(lines: CustomerCartLine[]): number {
    return lines.reduce((sum, line) => sum + line.quantity, 0);
  }

  setOrderType(orderType: OrderType): void {
    this.orderType = orderType;
    if (orderType === OrderType.TakeAway) {
      this.selectedTableId = null;
    }
  }

  setSelectedTable(value: string): void {
    const id = Number(value);
    this.selectedTableId = Number.isFinite(id) && id > 0 ? id : null;
  }

  updateQuantity(line: CustomerCartLine, quantity: number): void {
    this.cart.updateQuantity(line.item.id, quantity);
  }

  updateNotes(line: CustomerCartLine, event: Event): void {
    this.cart.updateNotes(line.item.id, (event.target as HTMLInputElement | null)?.value ?? '');
  }

  updateOrderNotes(event: Event): void {
    this.notes = (event.target as HTMLTextAreaElement | null)?.value ?? '';
  }

  remove(line: CustomerCartLine): void {
    this.cart.removeItem(line.item.id);
  }

  submit(lines: CustomerCartLine[]): void {
    if (this.isSubmitting) {
      return;
    }

    if (!lines.length) {
      this.errorMessage = 'יש להוסיף לפחות מנה אחת להזמנה.';
      this.feedback.error(null, this.errorMessage);
      return;
    }

    if (this.orderType === OrderType.DineIn && !this.selectedTableId) {
      this.errorMessage = 'יש לבחור שולחן להזמנה במסעדה.';
      this.feedback.error(null, this.errorMessage);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.customerOrders.createOrder({
      orderType: this.orderType,
      tableId: this.selectedTableId,
      notes: this.notes,
      items: lines.map((line) => ({
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
        this.cart.clear();
        this.feedback.success();
        void this.router.navigate(['/orders', order.id]);
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לשלוח את ההזמנה. בדקו את הפרטים ונסו שוב.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }
}
