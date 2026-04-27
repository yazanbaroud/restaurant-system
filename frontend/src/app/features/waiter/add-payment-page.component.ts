import { AsyncPipe, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, combineLatest, finalize, map, of, startWith, tap } from 'rxjs';

import { Order, Payment, PaymentMethod, PaymentStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { paymentMethodLabels, paymentStatusLabels, paymentStatusTones } from '../../shared/ui-labels';

interface PaymentViewModel {
  order: Order | null;
  payments: Payment[];
  totalPaid: number;
  remainingBalance: number;
  progressPercent: number;
  isPaid: boolean;
  isLoading: boolean;
}

@Component({
  selector: 'app-add-payment-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, DecimalPipe, PageHeaderComponent, ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  template: `
    @if (vm$ | async; as vm) {
      @if (vm.isLoading) {
        <section class="page-surface narrow-page empty-state">
          <h1>טוען תשלום...</h1>
        </section>
      } @else if (vm.order; as order) {
        <section class="page-surface payment-page">
          <app-page-header
            eyebrow="תשלום"
            [title]="'גביית תשלום להזמנה #' + order.orderNumber"
            [subtitle]="customerName(order)"
          >
            <a class="btn btn-ghost" [routerLink]="[orderDetailsBaseLink, order.id]">חזרה להזמנה</a>
          </app-page-header>

          @if (vm.isPaid) {
            <div class="success-panel paid-state">
              <strong>ההזמנה שולמה במלואה</strong>
              <p>סטטוס התשלום התקבל מהשרת. אין יתרה פתוחה להזמנה זו.</p>
            </div>
          }

          @if (successMessage && !vm.isPaid) {
            <p class="success-note">{{ successMessage }}</p>
          }

          @if (errorMessage) {
            <div class="validation-note">{{ errorMessage }}</div>
          }

          <article class="panel payment-order-summary">
            <div>
              <p class="eyebrow">הזמנה #{{ order.orderNumber }}</p>
              <h2>{{ customerName(order) }}</h2>
              <span class="muted">{{ order.createdAt | date: 'medium' }}</span>
            </div>
            <div class="payment-summary-status">
              <app-status-badge
                [label]="paymentStatusLabels[order.paymentStatus]"
                [tone]="paymentStatusTones[order.paymentStatus]"
              />
              <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </div>
          </article>

          <div class="payment-summary-grid">
            <article class="payment-metric">
              <span>סה״כ הזמנה</span>
              <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </article>
            <article class="payment-metric">
              <span>שולם עד כה</span>
              <strong>{{ vm.totalPaid | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </article>
            <article class="payment-metric payment-metric--due">
              <span>יתרה שנותרה</span>
              <strong>{{ vm.remainingBalance | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </article>
          </div>

          <article class="panel payment-progress-panel">
            <div class="inline-between payment-section-title">
              <div>
                <h2>התקדמות תשלום</h2>
                <p class="muted">שולם {{ vm.progressPercent | number: '1.0-0' }}% מההזמנה</p>
              </div>
              <strong>{{ vm.remainingBalance | currency: 'ILS' : 'symbol' : '1.0-0' }} נותרו</strong>
            </div>
            <div class="payment-progress">
              <i [style.width.%]="vm.progressPercent"></i>
            </div>
            <div class="payment-progress-labels">
              <span>{{ vm.totalPaid | currency: 'ILS' : 'symbol' : '1.0-0' }} שולם</span>
              <span>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }} סה״כ</span>
            </div>
          </article>

          <div class="payment-layout">
            <article class="panel previous-payments">
              <div class="inline-between payment-section-title">
                <h2>תשלומים קיימים</h2>
                <span class="muted">{{ vm.payments.length }} תשלומים</span>
              </div>
              @if (vm.payments.length) {
                <div class="previous-payments-table">
                  <div class="previous-payments-table__head">
                    <span>סכום</span>
                    <span>אמצעי</span>
                    <span>תאריך</span>
                  </div>
                  @for (payment of vm.payments; track payment.id) {
                    <div class="previous-payments-table__row">
                      <strong>{{ payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                      <span>{{ paymentMethodLabels[payment.method] }}</span>
                      <time>{{ payment.paidAt | date: 'short' }}</time>
                    </div>
                  }
                </div>
              } @else {
                <div class="payment-empty-state">
                  <h2>לא בוצעו תשלומים עדיין</h2>
                </div>
              }
            </article>

            <form class="panel payment-form" [formGroup]="form" (ngSubmit)="submit()">
              <fieldset [disabled]="vm.isPaid || isSubmitting">
                <legend>הוספת תשלום</legend>

                <label>
                  סכום לתשלום
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    [max]="vm.remainingBalance"
                    formControlName="amount"
                    inputmode="decimal"
                  />
                </label>
                @if (showAmountRequiredError()) {
                  <p class="validation-note">סכום חובה</p>
                }
                @if (showAmountPositiveError()) {
                  <p class="validation-note">הסכום חייב להיות גדול מ־0</p>
                }
                @if (showAmountOverBalance(vm)) {
                  <p class="validation-note">לא ניתן לשלם יותר מהיתרה שנותרה</p>
                }

                <label>
                  אמצעי תשלום
                  <select formControlName="method">
                    <option [ngValue]="PaymentMethod.Cash">מזומן</option>
                    <option [ngValue]="PaymentMethod.CreditCard">אשראי</option>
                  </select>
                </label>

                <button class="btn btn-gold full" type="submit" [disabled]="isSubmitting || vm.isPaid">
                  {{ isSubmitting ? 'שומרים תשלום...' : 'הוספת תשלום' }}
                </button>

                @if (vm.isPaid) {
                  <p class="success-note">ההזמנה שולמה במלואה</p>
                }
              </fieldset>
            </form>
          </div>
        </section>
      } @else {
        <section class="page-surface narrow-page empty-state">
          <h1>{{ loadErrorMessage || 'ההזמנה לא נמצאה' }}</h1>
          <a class="btn btn-dark" [routerLink]="ordersHomeLink">חזרה להזמנות</a>
        </section>
      }
    }
  `,
  styles: [`
    .payment-page {
      display: grid;
      gap: 1rem;
    }

    .payment-order-summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: center;
      background:
        linear-gradient(135deg, rgba(31, 21, 17, 0.96), rgba(61, 37, 25, 0.9)),
        var(--brown-950);
      color: var(--ivory);
    }

    .payment-order-summary h2,
    .payment-order-summary .eyebrow {
      color: var(--ivory);
    }

    .payment-order-summary h2 {
      margin-block: 0 0.3rem;
      font-size: 2rem;
    }

    .payment-summary-status {
      display: grid;
      justify-items: end;
      gap: 0.65rem;
    }

    .payment-summary-status strong {
      color: var(--ivory);
      font-size: 2rem;
      line-height: 1.1;
    }

    .payment-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .payment-metric {
      display: grid;
      gap: 0.3rem;
      min-height: 112px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.84);
      box-shadow: 0 10px 26px rgba(31, 21, 17, 0.08);
    }

    .payment-metric span {
      color: var(--muted);
      font-weight: 850;
    }

    .payment-metric strong {
      color: var(--brown-950);
      font-size: 1.55rem;
      line-height: 1.1;
    }

    .payment-metric--due {
      border-color: rgba(199, 154, 59, 0.42);
      background: rgba(199, 154, 59, 0.12);
    }

    .payment-section-title {
      align-items: center;
      margin-bottom: 0.85rem;
    }

    .payment-section-title h2,
    .payment-section-title p {
      margin: 0;
    }

    .payment-progress {
      height: 14px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(61, 37, 25, 0.1);
    }

    .payment-progress i {
      display: block;
      height: 100%;
      min-width: 0;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--gold), var(--olive));
    }

    .payment-progress-labels {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 0.6rem;
      color: var(--muted);
      font-weight: 850;
    }

    .payment-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);
      gap: 18px;
      align-items: start;
    }

    .previous-payments-table {
      display: grid;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
    }

    .previous-payments-table__head,
    .previous-payments-table__row {
      display: grid;
      grid-template-columns: 140px 140px minmax(0, 1fr);
      gap: 0.8rem;
      align-items: center;
      padding: 0.85rem 1rem;
    }

    .previous-payments-table__head {
      background: rgba(31, 21, 17, 0.06);
      color: var(--muted);
      font-size: 0.86rem;
      font-weight: 900;
    }

    .previous-payments-table__row + .previous-payments-table__row {
      border-top: 1px solid var(--line);
    }

    .previous-payments-table__row strong {
      color: var(--brown-950);
    }

    .previous-payments-table__row span,
    .previous-payments-table__row time {
      color: var(--muted);
      font-weight: 800;
    }

    .payment-empty-state {
      display: grid;
      place-items: center;
      min-height: 180px;
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      color: var(--muted);
      text-align: center;
    }

    .payment-empty-state h2 {
      margin: 0;
      color: var(--muted);
      font-size: 1.1rem;
    }

    .payment-form fieldset {
      display: grid;
      gap: 1rem;
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .payment-form legend {
      margin-bottom: 0.25rem;
      color: var(--brown-950);
      font-size: 1.35rem;
      font-weight: 900;
    }

    .paid-state {
      margin-bottom: 0;
    }

    @media (max-width: 860px) {
      .payment-order-summary,
      .payment-summary-grid,
      .payment-layout {
        grid-template-columns: 1fr;
      }

      .payment-summary-status {
        justify-items: start;
      }
    }

    @media (max-width: 620px) {
      .previous-payments-table__head {
        display: none;
      }

      .previous-payments-table__row {
        grid-template-columns: 1fr;
        gap: 0.3rem;
      }

      .previous-payments-table__row strong::before {
        content: 'סכום: ';
        color: var(--muted);
      }

      .previous-payments-table__row span::before {
        content: 'אמצעי: ';
        color: var(--muted);
      }

      .previous-payments-table__row time::before {
        content: 'תאריך: ';
        color: var(--muted);
        font-weight: 850;
      }

      .payment-progress-labels,
      .payment-section-title {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `]
})
export class AddPaymentPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  private readonly isAdminRoute = this.route.snapshot.pathFromRoot.some((route) => route.routeConfig?.path === 'admin') ||
    this.router.url.startsWith('/admin');
  private latestViewModel: PaymentViewModel | null = null;

  readonly PaymentMethod = PaymentMethod;
  readonly paymentMethodLabels = paymentMethodLabels;
  readonly paymentStatusLabels = paymentStatusLabels;
  readonly paymentStatusTones = paymentStatusTones;
  readonly orderDetailsBaseLink = this.isAdminRoute ? '/admin/orders' : '/waiter/orders';
  readonly ordersHomeLink = this.isAdminRoute ? ['/admin/orders'] : ['/waiter'];
  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: [PaymentMethod.CreditCard, Validators.required]
  });
  readonly vm$: Observable<PaymentViewModel> = Number.isFinite(this.id) && this.id > 0
    ? combineLatest([this.data.getOrder(this.id), this.data.getPaymentsForOrder(this.id)]).pipe(
        map(([order, payments]) => this.createViewModel(order ?? null, payments)),
        tap((vm) => this.syncFormWithViewModel(vm)),
        catchError(() => {
          this.loadErrorMessage = 'לא הצלחנו לטעון את פרטי התשלום. נסו שוב בעוד רגע.';
          return of(this.createViewModel(null, []));
        }),
        startWith({
          order: null,
          payments: [],
          totalPaid: 0,
          remainingBalance: 0,
          progressPercent: 0,
          isPaid: false,
          isLoading: true
        })
      )
    : of(this.createViewModel(null, []));

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';
  loadErrorMessage = '';
  submitted = false;

  get amountValue(): number {
    return Number(this.form.controls.amount.value) || 0;
  }

  customerName(order: Order): string {
    return `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'לקוח ללא שם';
  }

  showAmountRequiredError(): boolean {
    const control = this.form.controls.amount;
    return this.shouldShowAmountError() && control.hasError('required');
  }

  showAmountPositiveError(): boolean {
    return this.shouldShowAmountError() && !this.showAmountRequiredError() && this.amountValue <= 0;
  }

  showAmountOverBalance(vm: PaymentViewModel): boolean {
    return this.shouldShowAmountError() && !vm.isPaid && this.amountValue > vm.remainingBalance;
  }

  canSubmit(vm: PaymentViewModel): boolean {
    return (
      Boolean(vm.order) &&
      this.form.valid &&
      !this.isSubmitting &&
      !vm.isPaid &&
      vm.remainingBalance > 0 &&
      this.amountValue > 0 &&
      this.amountValue <= vm.remainingBalance
    );
  }

  submit(): void {
    const vm = this.latestViewModel;
    this.submitted = true;

    if (!vm || !this.canSubmit(vm)) {
      this.form.markAllAsTouched();
      return;
    }

    const amount = this.form.controls.amount.value;
    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.data.addPayment(this.id, amount, this.form.controls.method.value).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: () => {
        this.successMessage = 'התשלום נוסף בהצלחה';
        this.submitted = false;
        this.form.markAsPristine();
        this.form.markAsUntouched();
        const remainingBalance = this.latestViewModel?.remainingBalance ?? 0;
        this.form.controls.amount.setValue(remainingBalance, { emitEvent: false });
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לשמור את התשלום. נסו שוב בעוד רגע.';
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
        progressPercent: 0,
        isPaid: false,
        isLoading: false
      };
    }

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = Math.max(order.totalPrice - totalPaid, 0);
    const progressPercent = order.totalPrice > 0
      ? Math.min(100, Math.max(0, (totalPaid / order.totalPrice) * 100))
      : 0;

    return {
      order,
      payments,
      totalPaid,
      remainingBalance,
      progressPercent,
      isPaid: order.paymentStatus === PaymentStatus.Paid,
      isLoading: false
    };
  }

  private syncFormWithViewModel(vm: PaymentViewModel): void {
    this.latestViewModel = vm;
    if (!vm.order) {
      return;
    }

    if (vm.isPaid) {
      this.form.controls.amount.setValue(0, { emitEvent: false });
      return;
    }

    const amount = this.amountValue;
    if (!this.form.controls.amount.dirty || amount <= 0 || amount > vm.remainingBalance) {
      this.form.controls.amount.setValue(vm.remainingBalance, { emitEvent: false });
    }
  }

  private shouldShowAmountError(): boolean {
    const control = this.form.controls.amount;
    return this.submitted || control.touched || control.dirty;
  }
}
