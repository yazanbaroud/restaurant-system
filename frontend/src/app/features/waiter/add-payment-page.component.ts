import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, finalize, map, Observable, of, startWith, tap } from 'rxjs';

import { Order, Payment, PaymentMethod, PaymentStatus } from '../../core/models';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { paymentMethodLabels, paymentStatusLabels } from '../../shared/ui-labels';

interface PaymentViewModel {
  order: Order | null;
  payments: Payment[];
  totalPaid: number;
  remainingBalance: number;
  isPaid: boolean;
  isLoading: boolean;
}

@Component({
  selector: 'app-add-payment-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent, ReactiveFormsModule, RouterLink],
  template: `
    @if (vm$ | async; as vm) {
      @if (vm.isLoading) {
        <section class="page-surface empty-state">
          <h1>טוען תשלום...</h1>
        </section>
      } @else if (vm.order; as order) {
        <section class="page-surface payment-page">
          <app-page-header
            eyebrow="תשלום"
            [title]="'הזמנה #' + order.orderNumber"
            [subtitle]="customerName(order)"
          >
            <a class="btn btn-ghost" [routerLink]="[orderDetailsBaseLink, order.id]">חזרה להזמנה</a>
          </app-page-header>

          @if (errorMessage) {
            <p class="validation-note">{{ errorMessage }}</p>
          }
          @if (successMessage) {
            <p class="success-note">{{ successMessage }}</p>
          }

          <section class="payment-hero">
            <article>
              <span>סך הכל</span>
              <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </article>
            <article>
              <span>שולם</span>
              <strong>{{ vm.totalPaid | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </article>
            <article class="payment-hero__remaining">
              <span>נותר לתשלום</span>
              <strong>{{ vm.remainingBalance | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </article>
          </section>

          <div class="payment-layout">
            <section class="panel payment-actions-panel">
              <div class="inline-between">
                <h2>גבייה</h2>
                <span>{{ paymentStatusLabels[order.paymentStatus] }}</span>
              </div>

              @if (vm.isPaid) {
                <div class="paid-message">
                  ההזמנה שולמה במלואה.
                </div>
              } @else {
                <div class="quick-payment-grid">
                  <button type="button" class="btn btn-gold" [disabled]="isSubmitting" (click)="payRemaining(vm, PaymentMethod.Cash)">
                    מזומן
                  </button>
                  <button type="button" class="btn btn-dark" [disabled]="isSubmitting" (click)="payRemaining(vm, PaymentMethod.CreditCard)">
                    אשראי
                  </button>
                  <button type="button" class="btn btn-ghost" [disabled]="isSubmitting" (click)="toggleCustom(vm)">
                    סכום אחר
                  </button>
                </div>

                @if (customOpen) {
                  <form class="custom-payment-form" [formGroup]="form" (ngSubmit)="submitCustom(vm)">
                    <label>
                      סכום מפוצל
                      <input type="number" min="0.01" step="0.01" inputmode="decimal" formControlName="amount" />
                    </label>
                    <div class="segmented-control">
                      <button
                        type="button"
                        [class.active]="form.controls.method.value === PaymentMethod.Cash"
                        (click)="form.controls.method.setValue(PaymentMethod.Cash)"
                      >
                        מזומן
                      </button>
                      <button
                        type="button"
                        [class.active]="form.controls.method.value === PaymentMethod.CreditCard"
                        (click)="form.controls.method.setValue(PaymentMethod.CreditCard)"
                      >
                        אשראי
                      </button>
                    </div>
                    <button class="btn btn-gold full" type="submit" [disabled]="isSubmitting">
                      {{ isSubmitting ? 'שומר...' : 'שמירת תשלום' }}
                    </button>
                  </form>
                }
              }
            </section>

            <section class="panel payment-history-panel">
              <div class="inline-between">
                <h2>תשלומים</h2>
                <span>{{ vm.payments.length }}</span>
              </div>
              <div class="payment-history">
                @for (payment of vm.payments; track payment.id) {
                  <article>
                    <strong>{{ payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                    <span>{{ paymentMethodLabels[payment.method] }}</span>
                    <time>{{ payment.paidAt | date: 'short' }}</time>
                  </article>
                } @empty {
                  <div class="empty-state empty-state--compact">
                    <h2>אין תשלומים עדיין</h2>
                  </div>
                }
              </div>
            </section>
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
    .payment-page {
      display: grid;
      gap: 1rem;
    }

    .payment-hero {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .payment-hero article {
      display: grid;
      gap: 0.25rem;
      min-height: 104px;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.84);
      box-shadow: 0 10px 24px rgba(31, 21, 17, 0.08);
    }

    .payment-hero span,
    .payment-actions-panel span,
    .payment-history-panel span,
    .payment-history time {
      color: var(--muted);
      font-weight: 850;
    }

    .payment-hero strong {
      color: var(--brown-950);
      font-size: 1.55rem;
      line-height: 1.1;
    }

    .payment-hero__remaining {
      border-color: rgba(199, 154, 59, 0.42) !important;
      background: rgba(199, 154, 59, 0.12) !important;
    }

    .payment-layout {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      gap: 1rem;
      align-items: start;
    }

    .payment-actions-panel,
    .payment-history-panel,
    .custom-payment-form {
      display: grid;
      gap: 1rem;
    }

    .payment-actions-panel h2,
    .payment-history-panel h2 {
      margin: 0;
    }

    .quick-payment-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.65rem;
    }

    .quick-payment-grid .btn,
    .custom-payment-form .btn {
      min-height: 56px;
    }

    .paid-message {
      display: grid;
      place-items: center;
      min-height: 120px;
      border: 1px solid rgba(102, 112, 68, 0.26);
      border-radius: var(--radius);
      background: rgba(102, 112, 68, 0.12);
      color: var(--olive-dark);
      font-weight: 950;
      text-align: center;
    }

    .payment-history {
      display: grid;
      gap: 0.6rem;
    }

    .payment-history article {
      display: grid;
      grid-template-columns: minmax(90px, auto) minmax(0, 1fr) auto;
      gap: 0.75rem;
      align-items: center;
      padding: 0.8rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.68);
    }

    .payment-history strong {
      color: var(--brown-950);
    }

    @media (max-width: 760px) {
      .payment-hero,
      .payment-layout,
      .quick-payment-grid,
      .payment-history article {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AddPaymentPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly feedback = inject(FeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  private readonly isAdminRoute = this.route.snapshot.pathFromRoot.some((route) => route.routeConfig?.path === 'admin') ||
    this.router.url.startsWith('/admin');

  readonly PaymentMethod = PaymentMethod;
  readonly paymentMethodLabels = paymentMethodLabels;
  readonly paymentStatusLabels = paymentStatusLabels;
  readonly orderDetailsBaseLink = this.isAdminRoute ? '/admin/orders' : '/waiter/orders';
  readonly ordersHomeLink = this.isAdminRoute ? ['/admin/orders'] : ['/waiter'];
  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: [PaymentMethod.CreditCard, Validators.required]
  });
  readonly vm$: Observable<PaymentViewModel> = Number.isFinite(this.id) && this.id > 0
    ? combineLatest([this.data.getOrder(this.id), this.data.getPaymentsForOrder(this.id)]).pipe(
        map(([order, payments]) => this.createViewModel(order ?? null, payments)),
        tap((vm) => this.syncForm(vm)),
        catchError(() => {
          this.loadErrorMessage = 'לא הצלחנו לטעון את פרטי התשלום.';
          return of(this.createViewModel(null, []));
        }),
        startWith({
          order: null,
          payments: [],
          totalPaid: 0,
          remainingBalance: 0,
          isPaid: false,
          isLoading: true
        })
      )
    : of(this.createViewModel(null, []));

  isSubmitting = false;
  customOpen = false;
  errorMessage = '';
  successMessage = '';
  loadErrorMessage = '';

  customerName(order: Order): string {
    return `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'לקוח ללא שם';
  }

  payRemaining(vm: PaymentViewModel, method: PaymentMethod): void {
    this.submitPayment(vm, vm.remainingBalance, method);
  }

  toggleCustom(vm: PaymentViewModel): void {
    this.customOpen = !this.customOpen;
    if (this.customOpen) {
      this.form.controls.amount.setValue(vm.remainingBalance, { emitEvent: false });
    }
  }

  submitCustom(vm: PaymentViewModel): void {
    this.submitPayment(vm, Number(this.form.controls.amount.value) || 0, this.form.controls.method.value);
  }

  private submitPayment(vm: PaymentViewModel, amount: number, method: PaymentMethod): void {
    if (this.isSubmitting || !vm.order) {
      return;
    }

    if (vm.isPaid || vm.remainingBalance <= 0) {
      this.errorMessage = 'ההזמנה שולמה במלואה.';
      return;
    }

    if (amount <= 0 || amount > vm.remainingBalance) {
      this.errorMessage = 'סכום התשלום חייב להיות חיובי ולא גבוה מהיתרה.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.data.addPayment(vm.order.id, amount, method).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: () => {
        this.feedback.success();
        this.customOpen = false;
        const isClosingPayment = amount >= vm.remainingBalance;
        this.successMessage = isClosingPayment ? 'התשלום הושלם. חוזרים לשולחנות...' : 'התשלום נשמר.';
        if (isClosingPayment && !this.isAdminRoute && typeof window !== 'undefined') {
          window.setTimeout(() => void this.router.navigate(['/waiter']), 700);
        }
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לשמור את התשלום.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }

  private createViewModel(order: Order | null, payments: Payment[]): PaymentViewModel {
    if (!order) {
      return {
        order: null,
        payments,
        totalPaid: 0,
        remainingBalance: 0,
        isPaid: false,
        isLoading: false
      };
    }

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = Math.max(order.totalPrice - totalPaid, 0);

    return {
      order,
      payments,
      totalPaid,
      remainingBalance,
      isPaid: order.paymentStatus === PaymentStatus.Paid || remainingBalance <= 0,
      isLoading: false
    };
  }

  private syncForm(vm: PaymentViewModel): void {
    if (!vm.order || vm.isPaid) {
      this.form.controls.amount.setValue(0, { emitEvent: false });
      return;
    }

    if (!this.form.controls.amount.dirty || this.form.controls.amount.value > vm.remainingBalance) {
      this.form.controls.amount.setValue(vm.remainingBalance, { emitEvent: false });
    }
  }
}
