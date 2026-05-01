import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, combineLatest, map, of, startWith } from 'rxjs';

import { KitchenStatus, Order, OrderStatus, Payment, PaymentStatus, Table, TableStatus } from '../../core/models';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type TableServiceStatus = 'Available' | 'Occupied' | 'Ordering' | 'PaymentPending';

interface TableTile {
  table: Table;
  order: Order | null;
  status: TableServiceStatus;
  statusLabel: string;
  actionLabel: string;
  amountDue: number;
}

interface TablesViewModel {
  tiles: TableTile[];
  isLoading: boolean;
}

@Component({
  selector: 'app-waiter-tables-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, PageHeaderComponent],
  template: `
    <section class="page-surface waiter-tables-page">
      <app-page-header
        eyebrow="משמרת"
        title="שולחנות"
        subtitle="פותחים הזמנה משולחן פנוי או חוזרים מיד להזמנה פעילה."
      />

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (vm$ | async; as vm) {
        @if (vm.isLoading) {
          <div class="empty-state">
            <h2>טוען שולחנות...</h2>
          </div>
        } @else {
          <div class="table-status-strip" aria-label="סיכום שולחנות">
            @for (status of statusOrder; track status) {
              <button
                type="button"
                [class.active]="selectedStatus === status"
                (click)="toggleStatus(status)"
              >
                <i [class]="'status-dot status-dot--' + status"></i>
                <span>{{ statusLabels[status] }}</span>
                <strong>{{ countStatus(vm.tiles, status) }}</strong>
              </button>
            }
          </div>

          @if (visibleTiles(vm.tiles); as tiles) {
            @if (tiles.length) {
              <div class="waiter-table-grid">
                @for (tile of tiles; track tile.table.id) {
                  <button
                    type="button"
                    class="waiter-table-tile"
                    [class]="'waiter-table-tile waiter-table-tile--' + tile.status"
                    [disabled]="!canOpenTile(tile)"
                    (click)="openTable(tile)"
                  >
                    <span class="table-tile__status">{{ tile.statusLabel }}</span>
                    <strong>{{ tile.table.name }}</strong>
                    <small>{{ tile.table.capacity }} מקומות</small>

                    @if (tile.order) {
                      <span class="table-tile__order">#{{ tile.order.orderNumber }}</span>
                      <span class="table-tile__amount">{{ tile.amountDue | currency: 'ILS' : 'symbol' : '1.0-0' }}</span>
                    } @else if (tile.table.location) {
                      <span class="table-tile__order">{{ tile.table.location }}</span>
                    }

                    <em>{{ tile.actionLabel }}</em>
                  </button>
                }
              </div>
            } @else {
              <div class="empty-state">
                <h2>אין שולחנות תואמים</h2>
                <button type="button" class="btn btn-ghost" (click)="selectedStatus = 'all'">איפוס סינון</button>
              </div>
            }
          }
        }
      }
    </section>
  `,
  styles: [`
    .waiter-tables-page {
      display: grid;
      gap: 1rem;
    }

    .table-status-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.65rem;
    }

    .table-status-strip button {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem;
      min-height: 48px;
      padding: 0.7rem 0.8rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.78);
      color: var(--brown-950);
      font: inherit;
      font-weight: 900;
      cursor: pointer;
    }

    .table-status-strip button.active {
      border-color: rgba(31, 21, 17, 0.32);
      background: rgba(31, 21, 17, 0.08);
    }

    .status-dot {
      width: 0.72rem;
      height: 0.72rem;
      border-radius: 999px;
    }

    .status-dot--Available { background: var(--olive); }
    .status-dot--Occupied { background: var(--brown-950); }
    .status-dot--Ordering { background: var(--gold); }
    .status-dot--PaymentPending { background: var(--burgundy); }

    .waiter-table-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.75rem;
    }

    .waiter-table-tile {
      display: grid;
      gap: 0.3rem;
      min-height: 154px;
      padding: 1rem;
      border: 2px solid transparent;
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.82);
      color: var(--brown-950);
      text-align: start;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(31, 21, 17, 0.08);
    }

    .waiter-table-tile:disabled {
      cursor: not-allowed;
      opacity: 0.74;
    }

    .waiter-table-tile--Available { border-color: rgba(102, 112, 68, 0.42); }
    .waiter-table-tile--Occupied { border-color: rgba(31, 21, 17, 0.28); }
    .waiter-table-tile--Ordering { border-color: rgba(199, 154, 59, 0.56); }
    .waiter-table-tile--PaymentPending { border-color: rgba(161, 58, 42, 0.46); }

    .table-tile__status,
    .table-tile__order,
    .waiter-table-tile small {
      color: var(--muted);
      font-size: 0.86rem;
      font-weight: 850;
    }

    .waiter-table-tile strong {
      font-size: 1.25rem;
      line-height: 1.1;
      overflow-wrap: anywhere;
    }

    .table-tile__amount {
      font-weight: 950;
    }

    .waiter-table-tile em {
      align-self: end;
      margin-top: 0.35rem;
      font-style: normal;
      font-weight: 950;
    }

    @media (max-width: 760px) {
      .table-status-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .waiter-table-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `]
})
export class TablesPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly statusOrder: TableServiceStatus[] = ['Available', 'Ordering', 'Occupied', 'PaymentPending'];
  readonly statusLabels: Record<TableServiceStatus, string> = {
    Available: 'פנוי',
    Occupied: 'תפוס',
    Ordering: 'בהזמנה',
    PaymentPending: 'לתשלום'
  };
  readonly vm$ = combineLatest([this.data.getTables(), this.data.getOrders(), this.data.getPayments()]).pipe(
    map(([tables, orders, payments]) => ({
      tiles: this.createTiles(tables, orders, payments),
      isLoading: false
    })),
    catchError((error) => {
      this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לטעון את מפת השולחנות.');
      this.feedback.error(error, this.errorMessage);
      return of({ tiles: [], isLoading: false });
    }),
    startWith({ tiles: [], isLoading: true })
  );

  selectedStatus: TableServiceStatus | 'all' = 'all';
  errorMessage = '';

  visibleTiles(tiles: TableTile[]): TableTile[] {
    return this.selectedStatus === 'all'
      ? tiles
      : tiles.filter((tile) => tile.status === this.selectedStatus);
  }

  countStatus(tiles: TableTile[], status: TableServiceStatus): number {
    return tiles.filter((tile) => tile.status === status).length;
  }

  toggleStatus(status: TableServiceStatus): void {
    this.selectedStatus = this.selectedStatus === status ? 'all' : status;
  }

  canOpenTile(tile: TableTile): boolean {
    return Boolean(tile.order) || tile.status === 'Available';
  }

  openTable(tile: TableTile): void {
    if (tile.order) {
      void this.router.navigate(['/waiter/orders', tile.order.id]);
      return;
    }

    if (tile.status === 'Available') {
      void this.router.navigate(['/waiter/create-order'], { queryParams: { tableId: tile.table.id } });
    }
  }

  private createTiles(tables: Table[], orders: Order[], payments: Payment[]): TableTile[] {
    const activeOrders = orders.filter((order) => order.status === OrderStatus.Open);

    return tables
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((table) => {
        const order = activeOrders.find((candidate) => candidate.tables.some((orderTable) => orderTable.id === table.id)) ?? null;
        const status = this.tableStatus(table, order);
        return {
          table,
          order,
          status,
          statusLabel: this.statusLabels[status],
          actionLabel: order ? 'פתיחת הזמנה' : status === 'Available' ? 'הזמנה חדשה' : 'לא זמין',
          amountDue: order ? this.remainingBalance(order, payments) : 0
        };
      });
  }

  private tableStatus(table: Table, order: Order | null): TableServiceStatus {
    if (order) {
      const paymentStarted = order.paymentStatus === PaymentStatus.Partial || order.paymentStatus === PaymentStatus.Refunded;
      const servedWithoutFullPayment = order.kitchenStatus === KitchenStatus.Served && order.paymentStatus !== PaymentStatus.Paid;

      if (paymentStarted || servedWithoutFullPayment) {
        return 'PaymentPending';
      }

      if (order.kitchenStatus === KitchenStatus.New) {
        return 'Ordering';
      }

      return 'Occupied';
    }

    return table.status === TableStatus.Available ? 'Available' : 'Occupied';
  }

  private remainingBalance(order: Order, payments: Payment[]): number {
    if (order.paymentStatus === PaymentStatus.Paid) {
      return 0;
    }

    const totalPaid = payments
      .filter((payment) => payment.orderId === order.id)
      .reduce((sum, payment) => sum + payment.amount, 0);

    return Math.max(order.totalPrice - totalPaid, 0);
  }
}
