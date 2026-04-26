import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Table, TableStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TableCardComponent } from '../../shared/components/table-card.component';

@Component({
  selector: 'app-tables-management-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, RouterLink, TableCardComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול שולחנות"
        title="שולחנות ומצב תפוסה"
        subtitle="חיפוש, סינון וניהול מצב שולחנות בזמן אמת."
      />

      <div class="panel tables-toolbar">
        <label class="toolbar-search">
          חיפוש שולחנות
          <input
            #tableSearch
            type="search"
            [value]="searchTerm"
            (input)="searchTerm = tableSearch.value"
            placeholder="חיפוש לפי שם שולחן או מיקום"
            autocomplete="off"
          />
        </label>

        <label class="toolbar-filter">
          מצב
          <select #statusSelect [value]="statusFilterValue()" (change)="setStatusFilter(statusSelect.value)">
            <option value="all">הכל</option>
            <option [value]="tableStatusValue(TableStatus.Available)">פנוי</option>
            <option [value]="tableStatusValue(TableStatus.Reserved)">שמור</option>
            <option [value]="tableStatusValue(TableStatus.Occupied)">תפוס</option>
          </select>
        </label>

        <div class="actions-inline toolbar-actions">
          <a class="btn btn-gold" routerLink="/admin/tables/new">שולחן חדש</a>
        </div>
      </div>

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (tables$ | async; as tables) {
        @if (filteredTables(tables); as visibleTables) {
          <div class="tables-list-header">
            <p>מציג {{ visibleTables.length }} מתוך {{ tables.length }} שולחנות</p>
          </div>

          @if (!tables.length) {
            <div class="empty-state">
              <h2>לא נמצאו שולחנות</h2>
            </div>
          } @else if (visibleTables.length) {
            <div class="table-grid tables-grid">
              @for (table of visibleTables; track table.id) {
                <article class="table-management-card tables-management-card">
                  <app-table-card [table]="table" />
                  <div class="actions-inline table-card-actions">
                    <a class="btn btn-small btn-ghost" [routerLink]="['/admin/tables', table.id, 'edit']">עריכה</a>
                    <button class="btn btn-small btn-olive" type="button" [disabled]="isUpdating(table.id)" (click)="setStatus(table.id, TableStatus.Available)">פנוי</button>
                    <button class="btn btn-small btn-gold" type="button" [disabled]="isUpdating(table.id)" (click)="setStatus(table.id, TableStatus.Reserved)">שמור</button>
                    <button class="btn btn-small btn-ghost" type="button" [disabled]="isUpdating(table.id)" (click)="setStatus(table.id, TableStatus.Occupied)">תפוס</button>
                  </div>
                </article>
              }
            </div>
          } @else {
            <div class="empty-state">
              <h2>לא נמצאו שולחנות מתאימים</h2>
            </div>
          }
        }
      } @else {
        <div class="empty-state">
          <h2>טוען שולחנות...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .tables-toolbar {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(150px, 220px) auto;
      align-items: end;
      gap: 1rem;
    }

    .toolbar-actions {
      justify-content: flex-end;
    }

    .tables-list-header {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 800;
      margin-block: 0.8rem;
    }

    .tables-list-header p {
      margin: 0;
    }

    .tables-grid {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }

    .tables-management-card {
      display: grid;
      gap: 0.75rem;
      padding: 0;
      overflow: hidden;
    }

    .table-card-actions {
      padding: 0 16px 16px;
    }

    @media (max-width: 760px) {
      .tables-toolbar {
        grid-template-columns: 1fr;
      }

      .toolbar-actions {
        justify-content: flex-start;
      }

      .toolbar-actions .btn {
        flex: 1 1 150px;
      }

      .tables-list-header {
        justify-content: flex-start;
      }

      .tables-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class TablesManagementPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly tables$ = this.data.getTables();
  readonly TableStatus = TableStatus;

  updatingTableId: number | null = null;
  errorMessage = '';
  searchTerm = '';
  statusFilter: TableStatus | 'all' = 'all';

  setStatus(id: number, status: TableStatus): void {
    if (this.updatingTableId) {
      return;
    }

    this.updatingTableId = id;
    this.errorMessage = '';
    this.data.updateTableStatus(id, status).pipe(
      finalize(() => {
        this.updatingTableId = null;
      })
    ).subscribe({
      error: () => {
        this.errorMessage = 'לא הצלחנו לעדכן את מצב השולחן. נסו שוב בעוד רגע.';
      }
    });
  }

  isUpdating(id: number): boolean {
    return this.updatingTableId === id;
  }

  setStatusFilter(value: string): void {
    this.statusFilter = value === 'all' ? 'all' : Number(value) as TableStatus;
  }

  statusFilterValue(): string {
    return this.statusFilter === 'all' ? 'all' : this.tableStatusValue(this.statusFilter);
  }

  tableStatusValue(status: TableStatus): string {
    return String(status);
  }

  filteredTables(tables: Table[]): Table[] {
    const search = this.normalizeSearch(this.searchTerm);

    return tables.filter((table) => {
      if (this.statusFilter !== 'all' && table.status !== this.statusFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchableText = [
        table.name,
        table.location ?? '',
        table.notes ?? ''
      ].join(' ').toLowerCase();

      return searchableText.includes(search);
    });
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }
}
