import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { CustomerOrdersService } from '../../core/services/customer-orders.service';
import { OrderCardComponent } from '../../shared/components/order-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-customer-orders-page',
  standalone: true,
  imports: [AsyncPipe, OrderCardComponent, PageHeaderComponent, RouterLink],
  template: `
    <section class="page-surface customer-orders-page">
      <app-page-header
        eyebrow="הזמנות"
        title="ההזמנות שלי"
        subtitle="מעקב אחרי סטטוס ההזמנה וסטטוס התשלום של הזמנות שבוצעו מהחשבון שלכם."
      >
        <a class="btn btn-gold" routerLink="/menu">הזמנה חדשה</a>
      </app-page-header>

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (orders$ | async; as orders) {
        @if (orders.length) {
          <div class="customer-orders-count">מציג {{ orders.length }} הזמנות</div>
          <div class="resource-grid customer-orders-grid">
            @for (order of orders; track order.id) {
              <app-order-card [order]="order" [detailsLink]="['/orders', order.id]" />
            }
          </div>
        } @else {
          <div class="empty-state">
            <h2>עדיין אין הזמנות</h2>
            <p class="muted">כשתשלחו הזמנה מהעגלה, היא תופיע כאן למעקב.</p>
            <a class="btn btn-gold" routerLink="/menu">מעבר לתפריט</a>
          </div>
        }
      } @else {
        <div class="empty-state">
          <h2>טוען הזמנות...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .customer-orders-page {
      display: grid;
      gap: 1rem;
    }

    .customer-orders-count {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 850;
    }

    .customer-orders-grid {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
  `]
})
export class CustomerOrdersPageComponent {
  private readonly customerOrders = inject(CustomerOrdersService);
  errorMessage = '';

  readonly orders$ = this.customerOrders.getOrders().pipe(
    catchError(() => {
      this.errorMessage = 'לא הצלחנו לטעון את ההזמנות.';
      return of([]);
    })
  );
}
