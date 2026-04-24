import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { OrderStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import {
  orderStatusLabels,
  orderStatusTones,
  orderTypeLabels,
  paymentStatusLabels,
  paymentStatusTones
} from '../../shared/ui-labels';

@Component({
  selector: 'app-order-details-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent, RouterLink, StatusBadgeComponent],
  template: `
    @if (order$ | async; as order) {
      <section class="page-surface">
        <app-page-header
          eyebrow="פרטי הזמנה"
          [title]="'הזמנה #' + order.orderNumber"
          [subtitle]="order.customerFirstName + ' ' + order.customerLastName"
        >
          <a class="btn btn-gold" [routerLink]="['/waiter/orders', order.id, 'payment']">גביית תשלום</a>
        </app-page-header>

        @if (errorMessage) {
          <p class="validation-note">{{ errorMessage }}</p>
        }

        <div class="details-layout">
          <article class="panel">
            <div class="badge-row">
              <app-status-badge [label]="orderStatusLabels[order.status]" [tone]="orderStatusTones[order.status]" />
              <app-status-badge [label]="paymentStatusLabels[order.paymentStatus]" [tone]="paymentStatusTones[order.paymentStatus]" />
              <app-status-badge [label]="orderTypeLabels[order.orderType]" tone="beige" />
            </div>
            <p class="muted">{{ order.createdAt | date: 'medium' }}</p>
            @if (order.notes) {
              <p class="note">{{ order.notes }}</p>
            }
            <div class="status-actions">
              <button class="btn btn-ghost" type="button" [disabled]="isUpdating" (click)="setStatus(OrderStatus.InSalads)">בסלטים</button>
              <button class="btn btn-ghost" type="button" [disabled]="isUpdating" (click)="setStatus(OrderStatus.InMain)">בעיקריות</button>
              <button class="btn btn-olive" type="button" [disabled]="isUpdating" (click)="setStatus(OrderStatus.Completed)">הושלם</button>
              <button class="btn btn-danger" type="button" [disabled]="isUpdating" (click)="setStatus(OrderStatus.Cancelled)">ביטול</button>
            </div>
          </article>

          <article class="panel">
            <h2>מנות</h2>
            <div class="line-table">
              @for (item of order.items; track item.id) {
                <div>
                  <span>{{ item.quantity }} × {{ item.menuItemName }}</span>
                  <strong>{{ item.lineTotal | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                </div>
              }
            </div>
            <div class="total-row">
              <span>סה״כ</span>
              <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </div>
          </article>
        </div>
      </section>
    }
  `
})
export class OrderDetailsPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  readonly OrderStatus = OrderStatus;
  readonly order$ = this.data.getOrder(this.id);
  readonly orderStatusLabels = orderStatusLabels;
  readonly orderStatusTones = orderStatusTones;
  readonly orderTypeLabels = orderTypeLabels;
  readonly paymentStatusLabels = paymentStatusLabels;
  readonly paymentStatusTones = paymentStatusTones;
  isUpdating = false;
  errorMessage = '';

  setStatus(status: OrderStatus): void {
    if (this.isUpdating) {
      return;
    }

    this.isUpdating = true;
    this.errorMessage = '';
    this.data.updateOrderStatus(this.id, status).pipe(
      finalize(() => {
        this.isUpdating = false;
      })
    ).subscribe({
      error: () => {
        this.errorMessage = 'לא הצלחנו לעדכן את סטטוס ההזמנה. נסו שוב בעוד רגע.';
      }
    });
  }
}
