import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { TableStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TableCardComponent } from '../../shared/components/table-card.component';

@Component({
  selector: 'app-tables-management-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, TableCardComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול שולחנות"
        title="תפוסה, קיבולת ומצבי שולחן"
        subtitle="שינוי מצב שולחן מתבצע במצב mock בלבד."
      />
      <div class="table-grid">
        @for (table of tables$ | async; track table.id) {
          <article class="table-management-card">
            <app-table-card [table]="table" />
            <div class="actions-inline">
              <button class="btn btn-small btn-olive" type="button" (click)="setStatus(table.id, TableStatus.Available)">פנוי</button>
              <button class="btn btn-small btn-gold" type="button" (click)="setStatus(table.id, TableStatus.Reserved)">שמור</button>
              <button class="btn btn-small btn-ghost" type="button" (click)="setStatus(table.id, TableStatus.Occupied)">תפוס</button>
            </div>
          </article>
        }
      </div>
    </section>
  `
})
export class TablesManagementPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly tables$ = this.data.getTables();
  readonly TableStatus = TableStatus;

  setStatus(id: number, status: TableStatus): void {
    this.data.updateTableStatus(id, status);
  }
}
