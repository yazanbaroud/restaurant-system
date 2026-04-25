import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, shareReplay, tap } from 'rxjs';

import { MenuCategory, MenuCategoryRecord, MenuItem } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { controlError } from '../../shared/form-validation';
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
            @if (fieldError('name')) {
              <span class="field-error">{{ fieldError('name') }}</span>
            }
          </label>
          <label>
            מחיר
            <input type="number" min="1" formControlName="price" />
            @if (fieldError('price')) {
              <span class="field-error">{{ fieldError('price') }}</span>
            }
          </label>
          @if (categories$ | async; as categories) {
            <label>
              קטגוריה
              <select formControlName="category" [disabled]="menuItemCreationBlocked(categories)">
                @for (category of activeCategories(categories); track category.id) {
                  <option [ngValue]="category.id">{{ category.name }}</option>
                }
              </select>
              @if (menuItemCreationBlocked(categories)) {
                <span class="field-error">יש ליצור קטגוריה פעילה לפני יצירת מנה.</span>
              }
              @if (fieldError('category')) {
                <span class="field-error">{{ fieldError('category') }}</span>
              }
            </label>
            <label>
              כתובת תמונה
              <input formControlName="imageUrl" />
            </label>
            <label class="full">
              תיאור
              <textarea rows="4" formControlName="description"></textarea>
              @if (fieldError('description')) {
                <span class="field-error">{{ fieldError('description') }}</span>
              }
            </label>
            <label class="checkbox-row full">
              <input type="checkbox" formControlName="isAvailable" />
              זמינה בתפריט
            </label>

            @if (errorMessage) {
              <p class="validation-note full">{{ errorMessage }}</p>
            }

            <div class="actions-inline full">
              <button class="btn btn-gold" type="submit" [disabled]="isSubmitting || menuItemCreationBlocked(categories)">
                {{ editingItemId ? 'שמירת שינויים' : 'יצירת מנה' }}
              </button>
              @if (editingItemId) {
                <button class="btn btn-ghost" type="button" [disabled]="isSubmitting" (click)="resetForm()">ביטול עריכה</button>
              }
            </div>
          }

          @if (form.controls.imageUrl.value) {
            <img class="image-preview full" [src]="form.controls.imageUrl.value" alt="תצוגת תמונת מנה" />
          }
        </form>

        <section class="panel form-grid">
          <h2 class="full">קטגוריות</h2>
          <form class="full form-grid" [formGroup]="categoryForm" (ngSubmit)="submitCategory()">
            <label>
              שם קטגוריה
              <input formControlName="name" />
              @if (categoryFieldError('name')) {
                <span class="field-error">{{ categoryFieldError('name') }}</span>
              }
            </label>
            <label class="checkbox-row">
              <input type="checkbox" formControlName="isActive" />
              פעילה
            </label>
            @if (categoryErrorMessage) {
              <p class="validation-note full">{{ categoryErrorMessage }}</p>
            }
            <div class="actions-inline full">
              <button class="btn btn-gold" type="submit" [disabled]="isCategorySubmitting">
                {{ editingCategoryId ? 'שמירה' : 'קטגוריה חדשה' }}
              </button>
              @if (editingCategoryId) {
                <button class="btn btn-ghost" type="button" [disabled]="isCategorySubmitting" (click)="resetCategoryForm()">ביטול</button>
              }
            </div>
          </form>

          @if (categories$ | async; as categories) {
            <div class="compact-list full">
              @for (category of categories; track category.id) {
                <div class="inline-between">
                  <span>{{ category.name }}</span>
                  <div class="actions-inline">
                    <app-status-badge [label]="category.isActive ? 'פעילה' : 'לא פעילה'" [tone]="category.isActive ? 'olive' : 'charcoal'" />
                    <button class="btn btn-small btn-ghost" type="button" [disabled]="isCategorySubmitting" (click)="editCategory(category)">עריכת קטגוריה</button>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <div class="resource-grid">
          @for (item of menuItems$ | async; track item.id) {
            <article class="resource-card menu-admin-card">
              <img [src]="item.images[0]" [alt]="item.name" loading="lazy" />
              <div class="inline-between">
                <app-status-badge [label]="categoryName(item)" tone="gold" />
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
  private latestCategories: MenuCategoryRecord[] = [];
  readonly categories$ = this.data.getMenuCategories().pipe(
    tap((categories) => {
      this.latestCategories = categories;
      this.ensureSelectedCategory(categories);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    price: [88, [Validators.required, Validators.min(1)]],
    category: [0, Validators.required],
    isAvailable: [true],
    imageUrl: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80']
  });
  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    isActive: [true]
  });

  editingItemId: number | null = null;
  editingCategoryId: number | null = null;
  actingItemId: number | null = null;
  isSubmitting = false;
  isCategorySubmitting = false;
  errorMessage = '';
  categoryErrorMessage = '';
  formSubmitted = false;
  categoryFormSubmitted = false;

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.formSubmitted = true;
    this.ensureSelectedCategory(this.latestCategories);
    if (this.menuItemCreationBlocked()) {
      this.errorMessage = 'יש ליצור קטגוריה פעילה לפני יצירת מנה.';
      this.form.markAllAsTouched();
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

  submitCategory(): void {
    if (this.isCategorySubmitting) {
      return;
    }

    this.categoryFormSubmitted = true;
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.isCategorySubmitting = true;
    this.categoryErrorMessage = '';
    const value = this.categoryForm.getRawValue();
    const request$ = this.editingCategoryId
      ? this.data.updateMenuCategory(this.editingCategoryId, value)
      : this.data.createMenuCategory(value);

    request$.pipe(
      finalize(() => {
        this.isCategorySubmitting = false;
      })
    ).subscribe({
      next: () => this.resetCategoryForm(),
      error: () => {
        this.categoryErrorMessage = 'לא הצלחנו לשמור את הקטגוריה. נסו שוב בעוד רגע.';
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

  editCategory(category: MenuCategoryRecord): void {
    if (this.isCategorySubmitting) {
      return;
    }

    this.editingCategoryId = category.id;
    this.categoryErrorMessage = '';
    this.categoryFormSubmitted = false;
    this.categoryForm.reset({
      name: category.name,
      isActive: category.isActive
    });
  }

  resetForm(): void {
    this.editingItemId = null;
    this.formSubmitted = false;
    this.form.reset({
      name: '',
      description: '',
      price: 88,
      category: this.defaultCategoryId(),
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80'
    });
  }

  resetCategoryForm(): void {
    this.editingCategoryId = null;
    this.categoryFormSubmitted = false;
    this.categoryForm.reset({
      name: '',
      isActive: true
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

  activeCategories(categories: MenuCategoryRecord[]): MenuCategoryRecord[] {
    return categories.filter((category) => category.isActive || category.id === this.form.controls.category.value);
  }

  menuItemCreationBlocked(categories = this.latestCategories): boolean {
    return !this.editingItemId && !this.firstActiveCategory(categories);
  }

  categoryName(item: MenuItem): string {
    return item.categoryName || categoryLabels[item.category as MenuCategory] || `קטגוריה ${item.category}`;
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.formSubmitted);
  }

  categoryFieldError(controlName: keyof typeof this.categoryForm.controls): string {
    return controlError(this.categoryForm.controls[controlName], this.categoryFormSubmitted);
  }

  private ensureSelectedCategory(categories: MenuCategoryRecord[]): void {
    const selectedCategory = Number(this.form.controls.category.value);
    const category = categories.find((candidate) => candidate.id === selectedCategory);
    const selectedIsValid = this.editingItemId ? !!category : category?.isActive === true;

    if (selectedIsValid) {
      return;
    }

    this.form.controls.category.setValue(this.defaultCategoryId(categories), { emitEvent: false });
  }

  private defaultCategoryId(categories = this.latestCategories): number {
    return this.firstActiveCategory(categories)?.id ?? 0;
  }

  private firstActiveCategory(categories: MenuCategoryRecord[]): MenuCategoryRecord | undefined {
    return categories.find((category) => category.isActive);
  }
}
