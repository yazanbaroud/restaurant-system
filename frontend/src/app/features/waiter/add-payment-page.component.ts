import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, tap } from 'rxjs';

import { Order, Payment, PaymentMethod } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

interface PaymentViewModel {
  order: Order;
  payments: Payment[];
  totalPaid: number;
  remainingBalance: number;
  isPaid: boolean;
}

@Component({
  selector: 'app-add-payment-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent, ReactiveFormsModule, RouterLink],
  template: `
    @if (vm$ | async; as vm) {
      <section class="page-surface narrow-page">
        <app-page-header
          eyebrow="תשלום"
          [title]="'גביית תשלום להזמנה #' + vm.order.orderNumber"
          [subtitle]="vm.order.customerFirstName + ' ' + vm.order.customerLastName"
        >
          <a class="btn btn-ghost" [routerLink]="['/waiter/orders', vm.order.id]">חזרה להזמנה</a>
        </app-page-header>

        @if (vm.isPaid) {
          <div class="success-panel paid-state">
            <strong>ההזמנה שולמה במלואה</strong>
            <p>אין יתרה פתוחה, ולא ניתן להוסיף תשלום נוסף במסך זה.</p>
          </div>
        }

        <div class="payment-summary-grid">
          <article class="payment-metric">
            <span>סה״כ הזמנה</span>
            <strong>{{ vm.order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
          </article>
          <article class="payment-metric">
            <span>שולם עד כה</span>
            <strong>{{ vm.totalPaid | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
          </article>
          <article class="payment-metric payment-metric--due">
            <span>יתרה לתשלום</span>
            <strong>{{ vm.remainingBalance | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
          </article>
        </div>

        <div class="payment-layout">
          <form class="panel payment-form" [formGroup]="form" (ngSubmit)="submit()">
            <fieldset class="form-grid" [disabled]="vm.isPaid">
              <legend>תשלום חדש</legend>
              <label>
                אמצעי תשלום
                <select formControlName="method">
                  <option [ngValue]="PaymentMethod.Cash">{{ paymentMethodLabels[PaymentMethod.Cash] }}</option>
                  <option [ngValue]="PaymentMethod.CreditCard">{{ paymentMethodLabels[PaymentMethod.CreditCard] }}</option>
                </select>
              </label>
              <label>
                סכום לתשלום
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  [max]="vm.remainingBalance"
                  formControlName="amount"
                />
              </label>
              @if (amountValue <= 0) {
                <p class="validation-note full">יש להזין סכום גדול מאפס.</p>
              }
              @if (amountValue > vm.remainingBalance && !vm.isPaid) {
                <p class="validation-note full">הסכום גבוה מהיתרה לתשלום.</p>
              }
              <button class="btn btn-gold full" type="submit" [disabled]="!canSubmit(vm)">
                הוספת תשלום
              </button>
            </fieldset>
          </form>

          <article class="panel previous-payments">
            <h2>תשלומים קודמים</h2>
            @for (payment of vm.payments; track payment.id) {
              <div class="previous-payment-row">
                <div>
                  <strong>{{ payment.amount | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                  <span>{{ paymentMethodLabels[payment.method] }}</span>
                </div>
                <time>{{ payment.paidAt | date: 'short' }}</time>
              </div>
            } @empty {
              <p class="muted">עדיין לא נרשמו תשלומים להזמנה זו.</p>
            }
          </article>
        </div>
      </section>
    } @else {
      <section class="page-surface narrow-page empty-state">
        <h1>ההזמנה לא נמצאה</h1>
        <a class="btn btn-dark" routerLink="/waiter">חזרה להזמנות פעילות</a>
      </section>
    }
  `
})
export class AddPaymentPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  private latestViewModel: PaymentViewModel | null = null;

  readonly PaymentMethod = PaymentMethod;
  readonly paymentMethodLabels = paymentMethodLabels;
  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: [PaymentMethod.CreditCard, Validators.required]
  });
  readonly vm$ = combineLatest([this.data.getOrder(this.id), this.data.getPaymentsForOrder(this.id)]).pipe(
    map(([order, payments]) => {
      if (!order) {
        return null;
      }

      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const remainingBalance = Math.max(order.totalPrice - totalPaid, 0);

      return {
        order,
        payments,
        totalPaid,
        remainingBalance,
        isPaid: totalPaid >= order.totalPrice
      };
    }),
    tap((vm) => {
      this.latestViewModel = vm;
      if (!vm) {
        return;
      }

      const amount = this.amountValue;
      if (vm.isPaid) {
        this.form.controls.amount.setValue(0, { emitEvent: false });
        return;
      }

      if (amount <= 0 || amount > vm.remainingBalance) {
        this.form.controls.amount.setValue(vm.remainingBalance, { emitEvent: false });
      }
    })
  );

  get amountValue(): number {
    return Number(this.form.controls.amount.value) || 0;
  }

  canSubmit(vm: PaymentViewModel): boolean {
    return this.form.valid && !vm.isPaid && this.amountValue > 0 && this.amountValue <= vm.remainingBalance;
  }

  submit(): void {
    const vm = this.latestViewModel;
    if (!vm || !this.canSubmit(vm)) {
      return;
    }

    const amount = this.form.controls.amount.value;
    this.form.controls.amount.setValue(0, { emitEvent: false });
    this.data.addPayment(this.id, amount, this.form.controls.method.value);
  }
}
