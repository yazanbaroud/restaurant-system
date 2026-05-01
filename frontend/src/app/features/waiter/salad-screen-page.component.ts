import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { catchError, finalize, map, of, startWith } from 'rxjs';

import { KitchenStatus, Order, OrderStatus } from '../../core/models';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-salad-screen-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, PageHeaderComponent],
  template: `
    <section class="page-surface salad-page" dir="rtl">
      <app-page-header
        eyebrow="סלטיה"
        title="הזמנות בסלטיה"
        subtitle="רק הזמנות שממתינות לסלטיה. סיום מעביר את ההזמנה למטבח הפנימי."
      />

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (orders$ | async; as orders) {
        <div class="salad-grid">
          @for (order of orders; track order.id) {
            <article class="salad-card">
              <div class="inline-between">
                <strong>#{{ order.orderNumber }}</strong>
                <time>{{ order.createdAt | date: 'shortTime' }}</time>
              </div>
              <p>{{ customerName(order) }}</p>
              <ul>
                @for (item of order.items; track item.id) {
                  <li>
                    <strong>{{ item.quantity }}</strong>
                    <span>{{ item.menuItemName }}</span>
                    @if (item.notes) {
                      <em>{{ item.notes }}</em>
                    }
                  </li>
                }
              </ul>
              <button
                type="button"
                class="btn btn-dark full"
                [disabled]="updatingOrderId === order.id"
                (click)="moveToKitchen(order)"
              >
                {{ updatingOrderId === order.id ? 'מעביר...' : 'העבר למטבח הפנימי' }}
              </button>
            </article>
          } @empty {
            <div class="empty-state">
              <h2>אין כרגע הזמנות בסלטיה</h2>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .salad-page {
      display: grid;
      gap: 1rem;
    }

    .salad-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
    }

    .salad-card {
      display: grid;
      gap: 0.8rem;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.88);
      box-shadow: 0 12px 28px rgba(31, 21, 17, 0.08);
    }

    .salad-card p,
    .salad-card ul {
      margin: 0;
    }

    .salad-card ul {
      display: grid;
      gap: 0.45rem;
      padding: 0;
      list-style: none;
    }

    .salad-card li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.5rem;
      padding: 0.45rem 0.5rem;
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.05);
    }

    .salad-card em {
      grid-column: 2;
      color: var(--muted);
      font-style: normal;
      font-weight: 750;
    }
  `]
})
export class SaladScreenPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly feedback = inject(FeedbackService);

  readonly orders$ = this.data.getSaladOrders().pipe(
    map((orders) =>
      orders
        .filter((order) => order.status === OrderStatus.Open && order.kitchenStatus === KitchenStatus.InSalads)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    ),
    catchError((error) => {
      this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לטעון את מסך הסלטיה.');
      return of([]);
    }),
    startWith([])
  );

  updatingOrderId: number | null = null;
  errorMessage = '';

  customerName(order: Order): string {
    return `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'לקוח ללא שם';
  }

  moveToKitchen(order: Order): void {
    if (this.updatingOrderId) {
      return;
    }

    this.updatingOrderId = order.id;
    this.errorMessage = '';
    this.data.advanceSaladStatus(order.id).pipe(
      finalize(() => {
        this.updatingOrderId = null;
      })
    ).subscribe({
      next: () => this.feedback.success('ההזמנה הועברה למטבח הפנימי.'),
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו להעביר את ההזמנה למטבח.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }
}
