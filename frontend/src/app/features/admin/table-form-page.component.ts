import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map, switchMap } from 'rxjs';

import { Table, TableStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { controlError } from '../../shared/form-validation';

@Component({
  selector: 'app-table-form-page',
  standalone: true,
  imports: [PageHeaderComponent, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול שולחנות"
        [title]="editingTableId ? 'עריכת שולחן' : 'יצירת שולחן חדש'"
        [subtitle]="editingTableId ? 'עדכון פרטי שולחן ומצב פעילות.' : 'הוספת שולחן חדש למפת המסעדה.'"
      >
        <a class="btn btn-ghost" routerLink="/admin/tables">חזרה לשולחנות</a>
      </app-page-header>

      @if (isLoadingTable) {
        <div class="empty-state">
          <h2>טוען שולחן...</h2>
        </div>
      } @else if (tableLoadError) {
        <div class="empty-state">
          <h2>{{ tableLoadError }}</h2>
          <a class="btn btn-gold" routerLink="/admin/tables">חזרה לשולחנות</a>
        </div>
      } @else {
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
            <a class="btn btn-ghost" routerLink="/admin/tables">ביטול</a>
          </div>
        </form>
      }
    </section>
  `,
  styles: [`
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
  `]
})
export class TableFormPageComponent implements OnInit {
  private readonly data = inject(RestaurantDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly TableStatus = TableStatus;
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    capacity: [4, [Validators.required, Validators.min(1)]],
    location: [''],
    notes: [''],
    status: [TableStatus.Available, Validators.required]
  });

  editingTableId: number | null = null;
  isLoadingTable = false;
  isSubmitting = false;
  tableLoadError = '';
  errorMessage = '';
  submitted = false;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.setupCreateForm();
      return;
    }

    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      this.tableLoadError = 'לא מצאנו את השולחן המבוקש.';
      return;
    }

    this.editingTableId = id;
    this.loadTable(id);
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

    const value = this.form.getRawValue();
    const basicInput = {
      name: value.name,
      capacity: value.capacity,
      location: value.location,
      notes: value.notes
    };

    this.isSubmitting = true;
    this.errorMessage = '';
    const request$ = this.editingTableId
      ? this.data.updateTable(this.editingTableId, basicInput).pipe(
          switchMap(() => this.data.updateTableStatus(this.editingTableId!, value.status))
        )
      : this.data.createTable({
          ...basicInput,
          status: TableStatus.Available
        });

    request$.pipe(
      finalize(() => {
        this.isSubmitting = false;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        void this.router.navigate(['/admin/tables']);
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לשמור את השולחן. נסו שוב בעוד רגע.';
      }
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

  private setupCreateForm(): void {
    this.editingTableId = null;
    this.submitted = false;
    this.form.reset({
      name: '',
      capacity: 4,
      location: '',
      notes: '',
      status: TableStatus.Available
    });
    this.form.controls.status.disable({ emitEvent: false });
  }

  private loadTable(id: number): void {
    this.isLoadingTable = true;
    this.data.getTables().pipe(
      map((tables) => tables.find((table) => table.id === id)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (table) => {
        this.isLoadingTable = false;
        if (!table) {
          this.tableLoadError = 'לא מצאנו את השולחן המבוקש.';
          return;
        }

        this.fillEditForm(table);
      },
      error: () => {
        this.isLoadingTable = false;
        this.tableLoadError = 'לא הצלחנו לטעון את השולחן. נסו שוב בעוד רגע.';
      }
    });
  }

  private fillEditForm(table: Table): void {
    this.form.reset({
      name: table.name,
      capacity: table.capacity,
      location: table.location ?? '',
      notes: table.notes ?? '',
      status: table.status
    });
    this.form.controls.status.enable({ emitEvent: false });
  }
}
