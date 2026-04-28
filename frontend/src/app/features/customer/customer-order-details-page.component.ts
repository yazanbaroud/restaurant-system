import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { Order } from '../../core/models';
import { CustomerOrdersService } from '../../core/services/customer-orders.service';
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
  selector: 'app-customer-order-details-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, PageHeaderComponent, RouterLink, StatusBadgeComponent],
  template: `
    @if (order$ | async; as order) {
      @if (order) {
        <section class="page-surface customer-order-details-page">
          <app-page-header
            eyebrow="מעקב הזמנה"
            title="הזמנה #{{ order.orderNumber }}"
            subtitle="סטטוס ההזמנה והתשלום מתעדכנים על ידי צוות המסעדה."
          >
            <a class="btn btn-ghost" routerLink="/orders">חזרה להזמנות</a>
          </app-page-header>

          <section class="panel customer-order-hero">
            <div>
              <p class="eyebrow">{{ order.createdAt | date: 'short' }}</p>
              <h2>{{ order.customerFirstName }} {{ order.customerLastName }}</h2>
              <div class="badge-row">
                <app-status-badge [label]="orderStatusLabels[order.status]" [tone]="orderStatusTones[order.status]" />
                <app-status-badge [label]="paymentStatusLabels[order.paymentStatus]" [tone]="paymentStatusTones[order.paymentStatus]" />
                <app-status-badge [label]="orderTypeLabels[order.orderType]" tone="beige" />
              </div>
            </div>
            <strong>{{ order.totalPrice | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
          </section>

          <div class="customer-order-layout">
            <section class="panel customer-order-section">
              <h2>מנות בהזמנה</h2>
              <div class="customer-order-items">
                @for (item of order.items; track item.id) {
                  <div class="customer-order-item">
                    <div>
                      <strong>{{ item.quantity }} × {{ item.menuItemName }}</strong>
                      @if (item.notes) {
                        <span>{{ item.notes }}</span>
                      }
                    </div>
                    <div>
                      <span>{{ item.unitPrice | currency: 'ILS' : 'symbol' : '1.0-0' }} למנה</span>
                      <strong>{{ item.lineTotal | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                    </div>
                  </div>
                }
              </div>
            </section>

            <aside class="panel customer-order-section">
              <h2>פרטי הזמנה</h2>
              <dl class="customer-order-meta">
                <div>
                  <dt>מספר הזמנה</dt>
                  <dd>#{{ order.orderNumber }}</dd>
                </div>
                <div>
                  <dt>סוג הזמנה</dt>
                  <dd>{{ orderTypeLabels[order.orderType] }}</dd>
                </div>
                <div>
                  <dt>שולחן</dt>
                  <dd>{{ tableNames(order) }}</dd>
                </div>
                <div>
                  <dt>סטטוס הזמנה</dt>
                  <dd>{{ orderStatusLabels[order.status] }}</dd>
                </div>
                <div>
                  <dt>סטטוס תשלום</dt>
                  <dd>{{ paymentStatusLabels[order.paymentStatus] }}</dd>
                </div>
              </dl>
              @if (order.notes) {
                <p class="note">הערה: {{ order.notes }}</p>
              }
            </aside>
          </div>
        </section>
      } @else {
        <section class="page-surface narrow-page empty-state">
          <h1>לא מצאנו את ההזמנה המבוקשת</h1>
          <a class="btn btn-dark" routerLink="/orders">חזרה להזמנות</a>
        </section>
      }
    } @else {
      <section class="page-surface narrow-page empty-state">
        <h1>טוען הזמנה...</h1>
      </section>
    }
  `,
  styles: [`
    .customer-order-details-page {
      display: grid;
      gap: 1rem;
    }

    .customer-order-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .customer-order-hero h2 {
      margin: 0;
    }

    .customer-order-hero > strong {
      color: var(--burgundy);
      font-size: 2rem;
      white-space: nowrap;
    }

    .customer-order-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 18px;
      align-items: start;
    }

    .customer-order-section {
      display: grid;
      gap: 1rem;
    }

    .customer-order-items {
      display: grid;
      gap: 0.75rem;
    }

    .customer-order-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.62);
    }

    .customer-order-item div {
      display: grid;
      gap: 0.2rem;
    }

    .customer-order-item div:last-child {
      justify-items: end;
    }

    .customer-order-item span,
    .customer-order-meta dt {
      color: var(--muted);
      font-weight: 800;
    }

    .customer-order-meta {
      display: grid;
      gap: 0.75rem;
      margin: 0;
    }

    .customer-order-meta div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--line);
    }

    .customer-order-meta dd {
      margin: 0;
      color: var(--brown-950);
      font-weight: 900;
      text-align: end;
    }

    @media (max-width: 900px) {
      .customer-order-layout {
        grid-template-columns: 1fr;
      }

      .customer-order-hero {
        align-items: flex-start;
        flex-direction: column;
      }
    }

    @media (max-width: 620px) {
      .customer-order-item {
        grid-template-columns: 1fr;
      }

      .customer-order-item div:last-child {
        justify-items: start;
      }
    }
  `]
})
export class CustomerOrderDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly customerOrders = inject(CustomerOrdersService);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly orderStatusLabels = orderStatusLabels;
  readonly orderStatusTones = orderStatusTones;
  readonly orderTypeLabels = orderTypeLabels;
  readonly paymentStatusLabels = paymentStatusLabels;
  readonly paymentStatusTones = paymentStatusTones;

  readonly order$ = this.customerOrders.getOrder(this.id).pipe(
    catchError(() => of(null))
  );

  tableNames(order: Order): string {
    return order.tables.length ? order.tables.map((table) => table.name).join(', ') : 'ללא שולחן';
  }
}
