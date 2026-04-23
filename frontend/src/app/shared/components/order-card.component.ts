import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Order, OrderStatus } from '../../core/models';
import {
  orderStatusLabels,
  orderStatusTones,
  orderTypeLabels,
  paymentStatusLabels,
  paymentStatusTones
} from '../ui-labels';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusBadgeComponent],
  template: `
    <article class="resource-card order-card">
      <div class="inline-between">
        <div>
          <p class="eyebrow">הזמנה #{{ order.orderNumber }}</p>
          <h3>{{ order.customerFirstName }} {{ order.customerLastName }}</h3>
        </div>
        <app-status-badge [label]="paymentStatusLabels[order.paymentStatus]" [tone]="paymentStatusTones[order.paymentStatus]" />
      </div>
      <div class="badge-row">
        <app-status-badge [label]="orderStatusLabels[order.status]" [tone]="orderStatusTones[order.status]" />
        <app-status-badge [label]="orderTypeLabels[order.orderType]" tone="beige" />
        @for (table of order.tables; track table.id) {
          <app-status-badge [label]="table.name" tone="charcoal" />
        }
      </div>
      <p class="muted">{{ order.createdAt | date: 'short' }}</p>
      <ul class="compact-list">
        @for (item of order.items.slice(0, 3); track item.id) {
          <li>{{ item.quantity }} × {{ item.menuItemName }}</li>
        }
      </ul>
      <div class="inline-between">
        <strong class="price">{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
        <div class="actions-inline">
          @if (showStatusActions && order.status !== OrderStatus.Completed && order.status !== OrderStatus.Cancelled) {
            <button type="button" class="btn btn-small btn-ghost" (click)="advance.emit(order)">קידום</button>
          }
          <a class="btn btn-small btn-dark" [routerLink]="detailsLink">פתיחה</a>
        </div>
      </div>
    </article>
  `
})
export class OrderCardComponent {
  @Input({ required: true }) order!: Order;
  @Input({ required: true }) detailsLink!: unknown[];
  @Input() showStatusActions = false;
  @Output() advance = new EventEmitter<Order>();

  readonly OrderStatus = OrderStatus;
  readonly orderStatusLabels = orderStatusLabels;
  readonly orderStatusTones = orderStatusTones;
  readonly orderTypeLabels = orderTypeLabels;
  readonly paymentStatusLabels = paymentStatusLabels;
  readonly paymentStatusTones = paymentStatusTones;
}
