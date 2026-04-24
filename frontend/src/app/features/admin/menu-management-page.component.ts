import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { MenuCategory, MenuItem } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { categoryLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-menu-management-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, PageHeaderComponent, ReactiveFormsModule, StatusBadgeComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול תפריט"
        title="מנות, זמינות ותמונות"
        subtitle="יצירה, עריכה וניהול זמינות של מנות מול מערכת המסעדה."
      />

      <div class="management-layout">
        <form class="panel form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <h2 class="full">{{ editingItemId ? 'עריכת מנה' : 'מנה חדשה' }}</h2>
          <label>
            שם מנה
            <input formControlName="name" />
          </label>
          <label>
            מחיר
            <input type="number" min="1" formControlName="price" />
          </label>
          <label>
            קטגוריה
            <select formControlName="category">
              @for (category of categories; track category) {
                <option [ngValue]="category">{{ categoryLabels[category] }}</option>
              }
            </select>
          </label>
          <label>
            כתובת תמונה
            <input formControlName="imageUrl" />
          </label>
          <label class="full">
            תיאור
            <textarea rows="4" formControlName="description"></textarea>
          </label>
          <label class="checkbox-row full">
            <input type="checkbox" formControlName="isAvailable" />
            זמינה בתפריט
          </label>

          @if (errorMessage) {
            <p class="validation-note full">{{ errorMessage }}</p>
          }

          <div class="actions-inline full">
            <button class="btn btn-gold" type="submit" [disabled]="form.invalid || isSubmitting">
              {{ editingItemId ? 'שמירת שינויים' : 'יצירת מנה' }}
            </button>
            @if (editingItemId) {
              <button class="btn btn-ghost" type="button" [disabled]="isSubmitting" (click)="resetForm()">ביטול עריכה</button>
            }
          </div>

          @if (form.controls.imageUrl.value) {
            <img class="image-preview full" [src]="form.controls.imageUrl.value" alt="תצוגת תמונת מנה" />
          }
        </form>

        <div class="resource-grid">
          @for (item of menuItems$ | async; track item.id) {
            <article class="resource-card menu-admin-card">
              <img [src]="item.images[0]" [alt]="item.name" loading="lazy" />
              <div class="inline-between">
                <app-status-badge [label]="categoryLabels[item.category]" tone="gold" />
                <strong>{{ item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
              </div>
              <h3>{{ item.name }}</h3>
              <p class="muted">{{ item.description }}</p>
              <div class="actions-inline">
                <button type="button" class="btn btn-small btn-ghost" [disabled]="isSubmitting || isActing(item.id)" (click)="edit(item)">עריכה</button>
                <button type="button" class="btn btn-small" [class.btn-olive]="!item.isAvailable" [class.btn-ghost]="item.isAvailable" [disabled]="isActing(item.id)" (click)="toggle(item)">
                  {{ item.isAvailable ? 'הסתרה מהתפריט' : 'החזרה לתפריט' }}
                </button>
                <button type="button" class="btn btn-small btn-danger" [disabled]="isActing(item.id)" (click)="delete(item.id)">מחיקה</button>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `
})
export class MenuManagementPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly fb = inject(FormBuilder);

  readonly menuItems$ = this.data.getMenuItems();
  readonly categoryLabels = categoryLabels;
  readonly categories = Object.values(MenuCategory).filter((value): value is MenuCategory => typeof value === 'number');
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    price: [88, [Validators.required, Validators.min(1)]],
    category: [MenuCategory.Meats, Validators.required],
    isAvailable: [true],
    imageUrl: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80']
  });

  editingItemId: number | null = null;
  actingItemId: number | null = null;
  isSubmitting = false;
  errorMessage = '';

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const input = {
      name: value.name,
      description: value.description,
      price: value.price,
      category: value.category,
      isAvailable: value.isAvailable,
      images: value.imageUrl ? [value.imageUrl] : []
    };

    this.isSubmitting = true;
    this.errorMessage = '';
    const request$ = this.editingItemId
      ? this.data.updateMenuItem(this.editingItemId, input)
      : this.data.createMenuItem(input);

    request$.pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: () => this.resetForm(),
      error: () => {
        this.errorMessage = 'לא הצלחנו לשמור את המנה. נסו שוב בעוד רגע.';
      }
    });
  }

  edit(item: MenuItem): void {
    if (this.isSubmitting) {
      return;
    }

    this.editingItemId = item.id;
    this.errorMessage = '';
    this.form.reset({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      isAvailable: item.isAvailable,
      imageUrl: item.images[0] ?? ''
    });
  }

  resetForm(): void {
    this.editingItemId = null;
    this.form.reset({
      name: '',
      description: '',
      price: 88,
      category: MenuCategory.Meats,
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80'
    });
  }

  toggle(item: MenuItem): void {
    if (this.actingItemId) {
      return;
    }

    this.actingItemId = item.id;
    this.errorMessage = '';
    this.data.toggleMenuAvailability(item.id).pipe(
      finalize(() => {
        this.actingItemId = null;
      })
    ).subscribe({
      error: () => {
        this.errorMessage = 'לא הצלחנו לעדכן את זמינות המנה. נסו שוב בעוד רגע.';
      }
    });
  }

  delete(id: number): void {
    if (this.actingItemId) {
      return;
    }

    this.actingItemId = id;
    this.errorMessage = '';
    this.data.deleteMenuItem(id).pipe(
      finalize(() => {
        this.actingItemId = null;
      })
    ).subscribe({
      next: () => {
        if (this.editingItemId === id) {
          this.resetForm();
        }
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו למחוק את המנה. נסו שוב בעוד רגע.';
      }
    });
  }

  isActing(id: number): boolean {
    return this.actingItemId === id;
  }
}
