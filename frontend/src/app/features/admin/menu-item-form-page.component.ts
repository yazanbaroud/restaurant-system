import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, shareReplay, tap } from 'rxjs';

import { MenuCategoryRecord, MenuItem } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { controlError } from '../../shared/form-validation';

@Component({
  selector: 'app-menu-item-form-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, PageHeaderComponent, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול תפריט"
        [title]="editingItemId ? 'עריכת מנה' : 'יצירת מנה חדשה'"
        [subtitle]="editingItemId ? 'עדכון פרטי המנה, הקטגוריה, המחיר והתמונה.' : 'הוספת מנה חדשה לתפריט המסעדה.'"
      >
        <a class="btn btn-ghost" routerLink="/admin/menu">חזרה לתפריט</a>
      </app-page-header>

      @if (categories$ | async; as categories) {
        @if (isLoadingItem) {
          <div class="empty-state">
            <h2>טוען מנה...</h2>
          </div>
        } @else if (itemLoadError) {
          <div class="empty-state">
            <h2>{{ itemLoadError }}</h2>
            <a class="btn btn-gold" routerLink="/admin/menu">חזרה לתפריט</a>
          </div>
        } @else {
          @if (menuItemCreationBlocked(categories)) {
            <p class="validation-note">יש ליצור קטגוריה פעילה לפני יצירת מנה.</p>
          }

          <form class="panel menu-item-form" [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-heading">
              <div>
                <p class="form-kicker">פרטי מנה</p>
                <h2>{{ editingItemId ? 'עריכת מנה' : 'יצירת מנה חדשה' }}</h2>
                @if (editingItemId && currentItem?.name) {
                  <span class="edit-context-text">עורכים כעת: {{ currentItem?.name }}</span>
                }
              </div>
            </div>

            <div class="dish-form-layout">
              <div class="form-grid dish-form-fields">
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
                <label>
                  קטגוריה
                  <select formControlName="category" [disabled]="menuItemCreationBlocked(categories)">
                    @for (category of activeCategories(categories); track category.id) {
                      <option [ngValue]="category.id">{{ category.name }}</option>
                    }
                  </select>
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
              </div>

              <aside class="dish-preview-card" aria-label="תצוגת מנה">
                @if (form.controls.imageUrl.value) {
                  <img [src]="form.controls.imageUrl.value" alt="תצוגת תמונת מנה" />
                } @else {
                  <div class="image-placeholder">אין תמונה</div>
                }
                <div class="dish-preview-body">
                  <span class="dish-preview-meta">{{ editingItemId ? 'תצוגת עריכה' : 'תצוגת מנה חדשה' }}</span>
                  <h3>{{ form.controls.name.value || 'שם המנה' }}</h3>
                  <p class="dish-preview-price">{{ form.controls.price.value | currency: 'ILS' : 'symbol' : '1.0-0' }}</p>
                </div>
              </aside>
            </div>

            @if (errorMessage) {
              <p class="validation-note">{{ errorMessage }}</p>
            }

            <div class="actions-inline form-actions">
              <button class="btn btn-gold" type="submit" [disabled]="isSubmitting || menuItemCreationBlocked(categories)">
                {{ editingItemId ? 'שמירת שינויים' : 'יצירת מנה' }}
              </button>
              <a class="btn btn-ghost" routerLink="/admin/menu">ביטול</a>
            </div>
          </form>
        }
      } @else {
        <div class="empty-state">
          <h2>טוען קטגוריות...</h2>
        </div>
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

    .form-kicker {
      margin: 0 0 0.2rem;
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 800;
    }

    .edit-context-text {
      display: inline-block;
      margin-top: 0.35rem;
      color: var(--muted);
      font-size: 0.92rem;
      font-weight: 700;
    }

    .menu-item-form {
      display: grid;
      gap: 1rem;
    }

    .dish-form-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
      gap: 1rem;
      align-items: start;
    }

    .dish-form-fields {
      align-items: start;
    }

    .dish-preview-card {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.74);
      box-shadow: 0 12px 28px rgba(31, 21, 17, 0.08);
    }

    .dish-preview-card img,
    .image-placeholder {
      width: 100%;
      aspect-ratio: 4 / 3;
    }

    .dish-preview-card img {
      object-fit: cover;
    }

    .image-placeholder {
      display: grid;
      place-items: center;
      color: var(--muted);
      background: rgba(234, 220, 199, 0.52);
      font-weight: 800;
    }

    .dish-preview-body {
      display: grid;
      gap: 0.25rem;
      padding: 0.9rem;
    }

    .dish-preview-body h3,
    .dish-preview-body p {
      margin: 0;
    }

    .dish-preview-body h3 {
      overflow-wrap: anywhere;
      font-size: 1rem;
    }

    .dish-preview-meta {
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 800;
    }

    .dish-preview-price {
      color: var(--gold-dark);
      font-weight: 900;
    }

    .form-actions {
      justify-content: flex-start;
    }

    @media (max-width: 900px) {
      .dish-form-layout {
        grid-template-columns: 1fr;
      }

      .dish-preview-card {
        max-width: 420px;
      }
    }

    @media (max-width: 640px) {
      .form-actions {
        align-items: stretch;
      }

      .form-actions .btn {
        flex: 1 1 140px;
      }
    }
  `]
})
export class MenuItemFormPageComponent implements OnInit {
  private readonly data = inject(RestaurantDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

  editingItemId: number | null = null;
  currentItem: MenuItem | null = null;
  isLoadingItem = false;
  isSubmitting = false;
  errorMessage = '';
  itemLoadError = '';
  formSubmitted = false;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.resetCreateForm();
      return;
    }

    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      this.itemLoadError = 'לא מצאנו את המנה המבוקשת.';
      return;
    }

    this.editingItemId = id;
    this.isLoadingItem = true;
    this.data.getMenuItem(id).pipe(
      finalize(() => {
        this.isLoadingItem = false;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (item) => {
        if (!item) {
          this.itemLoadError = 'לא מצאנו את המנה המבוקשת.';
          return;
        }

        this.currentItem = item;
        this.form.reset({
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          isAvailable: item.isAvailable,
          imageUrl: item.images[0] ?? ''
        });
        this.ensureSelectedCategory(this.latestCategories);
      },
      error: () => {
        this.itemLoadError = 'לא הצלחנו לטעון את המנה. נסו שוב בעוד רגע.';
      }
    });
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.formSubmitted = true;
    this.ensureSelectedCategory(this.latestCategories);
    this.markCategoryInvalidIfMissing();
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
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        void this.router.navigate(['/admin/menu']);
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לשמור את המנה. נסו שוב בעוד רגע.';
      }
    });
  }

  activeCategories(categories: MenuCategoryRecord[]): MenuCategoryRecord[] {
    return categories.filter((category) => category.isActive || category.id === this.form.controls.category.value);
  }

  menuItemCreationBlocked(categories = this.latestCategories): boolean {
    return !this.editingItemId && !this.firstActiveCategory(categories);
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];
    if (!control || (!this.formSubmitted && !control.touched && !control.dirty)) {
      return '';
    }

    if (controlName === 'name' && control.hasError('required')) {
      return 'שם חובה';
    }

    if (controlName === 'price' && (control.hasError('required') || control.hasError('min'))) {
      return 'מחיר חייב להיות גדול מ־0';
    }

    if (controlName === 'category' && (control.hasError('required') || Number(control.value) <= 0)) {
      return 'קטגוריה חובה';
    }

    if (controlName === 'description' && control.hasError('required')) {
      return 'תיאור חובה';
    }

    return controlError(this.form.controls[controlName], this.formSubmitted);
  }

  private resetCreateForm(): void {
    this.editingItemId = null;
    this.currentItem = null;
    this.formSubmitted = false;
    this.form.reset({
      name: '',
      description: '',
      price: 88,
      category: this.defaultCategoryId(),
      isAvailable: true,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80'
    });
    this.ensureSelectedCategory(this.latestCategories);
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

  private markCategoryInvalidIfMissing(): void {
    const control = this.form.controls.category;
    if (Number(control.value) <= 0) {
      control.setErrors({ required: true });
    }
  }
}
