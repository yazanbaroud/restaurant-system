import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';

import { PaymentMethod } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { paymentMethodLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-add-payment-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, PageHeaderComponent, ReactiveFormsModule],
  template: `
    @if (order$ | async; as order) {
      <section class="page-surface narrow-page">
        <app-page-header
          eyebrow="תשלום"
          [title]="'גביית תשלום להזמנה #' + order.orderNumber"
          [subtitle]="'לתשלום: ' + (order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0')"
        />
        <form class="panel form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            סכום
            <input type="number" min="0" formControlName="amount" />
          </label>
          <label>
            אמצעי תשלום
            <select formControlName="method">
              <option [ngValue]="PaymentMethod.Cash">{{ paymentMethodLabels[PaymentMethod.Cash] }}</option>
              <option [ngValue]="PaymentMethod.CreditCard">{{ paymentMethodLabels[PaymentMethod.CreditCard] }}</option>
            </select>
          </label>
          <button class="btn btn-gold full" type="submit" [disabled]="form.invalid">סימון כשולם</button>
        </form>
      </section>
    }
  `
})
export class AddPaymentPageComponent implements OnInit {
  private readonly data = inject(RestaurantDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly PaymentMethod = PaymentMethod;
  readonly paymentMethodLabels = paymentMethodLabels;
  readonly order$ = this.data.getOrder(this.id);
  readonly form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(1)]],
    method: [PaymentMethod.CreditCard, Validators.required]
  });

  ngOnInit(): void {
    this.order$.pipe(take(1)).subscribe((order) => {
      if (order) {
        this.form.controls.amount.setValue(order.totalPrice);
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    this.data.addPayment(this.id, this.form.controls.amount.value, this.form.controls.method.value);
    void this.router.navigate(['/waiter/orders', this.id]);
  }
}
