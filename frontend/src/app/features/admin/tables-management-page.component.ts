import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

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

      <form class="panel form-grid" [formGroup]="form" (ngSubmit)="submit()">
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
          אזור
          <input formControlName="location" />
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
          @if (editingTableId) {
            <button class="btn btn-ghost" type="button" [disabled]="isSubmitting" (click)="resetForm()">ביטול עריכה</button>
          }
        </div>
      </form>

      <div class="table-grid">
        @for (table of tables$ | async; track table.id) {
          <article class="table-management-card">
            <app-table-card [table]="table" />
            <div class="actions-inline">
              <button class="btn btn-small btn-ghost" type="button" [disabled]="isSubmitting || isUpdating(table.id)" (click)="edit(table)">עריכה</button>
              <button class="btn btn-small btn-olive" type="button" [disabled]="isUpdating(table.id)" (click)="setStatus(table.id, TableStatus.Available)">פנוי</button>
              <button class="btn btn-small btn-gold" type="button" [disabled]="isUpdating(table.id)" (click)="setStatus(table.id, TableStatus.Reserved)">שמור</button>
              <button class="btn btn-small btn-ghost" type="button" [disabled]="isUpdating(table.id)" (click)="setStatus(table.id, TableStatus.Occupied)">תפוס</button>
            </div>
          </article>
        }
      </div>
    </section>
  `
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
  isSubmitting = false;
  errorMessage = '';
  submitted = false;

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
    const input = this.form.getRawValue();
    const request$ = this.editingTableId
      ? this.data.updateTable(this.editingTableId, input)
      : this.data.createTable(input);

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
    this.errorMessage = '';
    this.form.reset({
      name: table.name,
      capacity: table.capacity,
      location: table.location ?? '',
      notes: table.notes ?? '',
      status: table.status
    });
  }

  resetForm(): void {
    this.editingTableId = null;
    this.submitted = false;
    this.form.reset({
      name: '',
      capacity: 4,
      location: '',
      notes: '',
      status: TableStatus.Available
    });
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

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.submitted);
  }
}
