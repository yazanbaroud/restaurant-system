import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, switchMap } from 'rxjs';

import { Table, TableStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TableCardComponent } from '../../shared/components/table-card.component';
import { controlError } from '../../shared/form-validation';

@Component({
  selector: 'app-tables-management-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, ReactiveFormsModule, TableCardComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול שולחנות"
        title="תפוסה, קיבולת ומצבי שולחן"
        subtitle="יצירה, עריכה וניהול מצב שולחנות מול מערכת המסעדה בזמן אמת."
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
          <button type="button" class="btn btn-gold" [disabled]="isSubmitting" (click)="startCreate()">שולחן חדש</button>
        </div>
      </div>

      @if (isFormOpen) {
        <form class="panel form-grid table-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-heading full">
            <h2>{{ editingTableId ? 'עריכת שולחן' : 'יצירת שולחן חדש' }}</h2>
          </div>

          <label>
            שם שולחן
            <input formControlName="name" />
            @if (fieldError('name')) {
              <span class="field-error">{{ fieldError('name') }}</span>
            }
          </label>
          <label>
            קיבולת
            <input type="number" min="1" formControlName="capacity" />
            @if (fieldError('capacity')) {
              <span class="field-error">{{ fieldError('capacity') }}</span>
            }
          </label>
          <label>
            מיקום במסעדה
            <input formControlName="location" placeholder="לדוגמה: מרפסת, פנים, ליד החלון" />
          </label>
          <label>
            מצב
            <select formControlName="status">
              <option [ngValue]="TableStatus.Available">פנוי</option>
              <option [ngValue]="TableStatus.Reserved">שמור</option>
              <option [ngValue]="TableStatus.Occupied">תפוס</option>
            </select>
          </label>
          <label class="full">
            הערות
            <textarea formControlName="notes" rows="3"></textarea>
          </label>

          @if (errorMessage) {
            <p class="validation-note full">{{ errorMessage }}</p>
          }

          <div class="actions-inline full">
            <button class="btn btn-gold" type="submit" [disabled]="isSubmitting">
              {{ editingTableId ? 'שמירת שינויים' : 'יצירת שולחן' }}
            </button>
            <button class="btn btn-ghost" type="button" [disabled]="isSubmitting" (click)="resetForm()">ביטול</button>
          </div>
        </form>
      }

      @if (!isFormOpen && errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (tables$ | async; as tables) {
        @if (filteredTables(tables); as visibleTables) {
          <div class="tables-list-header">
            <p>מציג {{ visibleTables.length }} מתוך {{ tables.length }} שולחנות</p>
          </div>

          @if (visibleTables.length) {
            <div class="table-grid tables-grid">
              @for (table of visibleTables; track table.id) {
                <article class="table-management-card tables-management-card">
                  <app-table-card [table]="table" />
                  <div class="actions-inline table-card-actions">
                    <button class="btn btn-small btn-ghost" type="button" [disabled]="isSubmitting || isUpdating(table.id)" (click)="edit(table)">עריכה</button>
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

    .form-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .form-heading h2 {
      margin: 0;
      font-size: 1.35rem;
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
  private readonly fb = inject(FormBuilder);

  readonly tables$ = this.data.getTables();
  readonly TableStatus = TableStatus;
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    capacity: [4, [Validators.required, Validators.min(1)]],
    location: [''],
    notes: [''],
    status: [TableStatus.Available, Validators.required]
  });

  editingTableId: number | null = null;
  updatingTableId: number | null = null;
  isFormOpen = false;
  isSubmitting = false;
  errorMessage = '';
  submitted = false;
  searchTerm = '';
  statusFilter: TableStatus | 'all' = 'all';

  startCreate(): void {
    if (this.isSubmitting) {
      return;
    }

    this.errorMessage = '';
    this.resetForm(true);
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.form.invalid) {
      this.submitted = true;
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    const basicInput = {
      name: this.form.controls.name.value,
      capacity: this.form.controls.capacity.value,
      location: this.form.controls.location.value,
      notes: this.form.controls.notes.value
    };
    const request$ = this.editingTableId
      ? this.data.updateTable(this.editingTableId, basicInput).pipe(
          switchMap(() => this.data.updateTableStatus(this.editingTableId!, this.form.controls.status.value))
        )
      : this.data.createTable({
          ...basicInput,
          status: TableStatus.Available
        });

    request$.pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: () => this.resetForm(),
      error: () => {
        this.errorMessage = 'לא הצלחנו לשמור את השולחן. נסו שוב בעוד רגע.';
      }
    });
  }

  edit(table: Table): void {
    if (this.isSubmitting) {
      return;
    }

    this.editingTableId = table.id;
    this.isFormOpen = true;
    this.errorMessage = '';
    this.form.reset({
      name: table.name,
      capacity: table.capacity,
      location: table.location ?? '',
      notes: table.notes ?? '',
      status: table.status
    });

    this.form.controls.status.enable({ emitEvent: false });
  }

  resetForm(keepOpen = false): void {
    this.editingTableId = null;
    this.isFormOpen = keepOpen;
    this.submitted = false;
    this.form.reset({
      name: '',
      capacity: 4,
      location: '',
      notes: '',
      status: TableStatus.Available
    });

    if (keepOpen) {
      this.form.controls.status.disable({ emitEvent: false });
    } else {
      this.form.controls.status.enable({ emitEvent: false });
    }
  }

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

  fieldError(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];
    if (!control || (!this.submitted && !control.touched && !control.dirty)) {
      return '';
    }

    if (controlName === 'name' && control.hasError('required')) {
      return 'שם שולחן חובה';
    }

    if (controlName === 'capacity' && (control.hasError('required') || control.hasError('min'))) {
      return 'קיבולת חייבת להיות לפחות 1';
    }

    return controlError(this.form.controls[controlName], this.submitted);
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }
}
