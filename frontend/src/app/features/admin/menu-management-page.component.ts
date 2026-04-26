import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  imports: [AsyncPipe, CurrencyPipe, PageHeaderComponent, ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול תפריט"
        title="מנות וזמינות"
        subtitle="ניהול רשימת המנות, זמינות וקטגוריות התפריט."
      />

      @if (categories$ | async; as categories) {
        <div class="panel menu-toolbar">
          <label class="toolbar-search">
            חיפוש מנות
            <input
              #menuSearch
              type="search"
              [value]="searchTerm"
              (input)="searchTerm = menuSearch.value"
              placeholder="חיפוש לפי שם מנה או תיאור"
              autocomplete="off"
            />
          </label>

          <label class="toolbar-filter">
            קטגוריה
            <select #categoryFilterSelect [value]="categoryFilterValue()" (change)="setCategoryFilter(categoryFilterSelect.value)">
              <option value="all">כל הקטגוריות</option>
              @for (category of categories; track category.id) {
                <option [value]="categoryValue(category.id)">{{ category.name }}</option>
              }
            </select>
          </label>

          <label class="toolbar-filter">
            זמינות
            <select #availabilitySelect [value]="availabilityFilter" (change)="setAvailabilityFilter(availabilitySelect.value)">
              <option value="all">הכל</option>
              <option value="available">זמין</option>
              <option value="unavailable">לא זמין</option>
            </select>
          </label>

          <div class="actions-inline toolbar-actions">
            <button class="btn btn-ghost" type="button" (click)="toggleCategoryPanel()">
              {{ isCategoryPanelOpen ? 'סגירת קטגוריות' : 'ניהול קטגוריות' }}
            </button>
            <button
              type="button"
              class="btn btn-gold"
              [routerLink]="['/admin/menu/new']"
              [disabled]="menuItemCreationBlocked(categories)"
            >
              מנה חדשה
            </button>
          </div>
        </div>

        @if (menuItemCreationBlocked(categories)) {
          <p class="validation-note">יש ליצור קטגוריה פעילה לפני יצירת מנה.</p>
        }

        @if (isCategoryPanelOpen) {
          <section class="panel category-management">
            <div class="inline-between category-management__header">
              <div>
                <p class="form-kicker">קטגוריות תפריט</p>
                <h2>ניהול קטגוריות</h2>
              </div>
              <button class="btn btn-small btn-ghost" type="button" (click)="toggleCategoryPanel()">סגירה</button>
            </div>

            <div class="category-panel-grid">
              @if (isCategoryFormOpen) {
                <form class="category-editor-card" [formGroup]="categoryForm" (ngSubmit)="submitCategory()">
                  <div class="category-section-heading">
                    <h3>{{ editingCategoryId ? 'עריכת קטגוריה' : 'קטגוריה חדשה' }}</h3>
                  </div>

                  <label>
                    שם קטגוריה
                    <input formControlName="name" />
                    @if (categoryFieldError('name')) {
                      <span class="field-error">{{ categoryFieldError('name') }}</span>
                    }
                  </label>
                  <label class="category-active-control">
                    <input type="checkbox" formControlName="isActive" />
                    <span>פעילה בתפריט</span>
                  </label>
                  @if (categoryErrorMessage) {
                    <p class="validation-note">{{ categoryErrorMessage }}</p>
                  }
                  <div class="actions-inline category-form-actions">
                    <button class="btn btn-gold" type="submit" [disabled]="isCategorySubmitting">שמירה</button>
                    <button class="btn btn-ghost" type="button" [disabled]="isCategorySubmitting" (click)="resetCategoryForm()">ביטול</button>
                  </div>
                </form>
              } @else {
                <div class="category-list-card">
                  <div class="inline-between category-section-heading">
                    <h3>רשימת קטגוריות</h3>
                    <button class="btn btn-small btn-gold" type="button" [disabled]="isCategorySubmitting" (click)="startCreateCategory()">קטגוריה חדשה</button>
                  </div>

                  @if (categorySuccessMessage) {
                    <p class="success-note">{{ categorySuccessMessage }}</p>
                  }
                  @if (categoryErrorMessage) {
                    <p class="validation-note">{{ categoryErrorMessage }}</p>
                  }

                  @if (!categories.length) {
                    <div class="category-empty-state">לא נמצאו קטגוריות</div>
                  } @else {
                    <div class="compact-list category-list">
                      @for (category of categories; track category.id) {
                        <div class="category-row">
                          <div class="category-row-main">
                            <span>{{ category.name }}</span>
                            <app-status-badge [label]="category.isActive ? 'פעילה' : 'לא פעילה'" [tone]="category.isActive ? 'olive' : 'charcoal'" />
                          </div>
                          <div class="actions-inline category-actions">
                            <button class="btn btn-small btn-ghost" type="button" [disabled]="isCategorySubmitting || isDeletingCategory(category.id)" (click)="editCategory(category)">עריכה</button>
                            <button class="btn btn-small btn-ghost category-delete-button" type="button" [disabled]="isCategorySubmitting || deletingCategoryId !== null" (click)="deleteCategory(category)">
                              מחיקה
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </section>
        }

        @if (errorMessage) {
          <p class="validation-note">{{ errorMessage }}</p>
        }

        @if (menuItems$ | async; as menuItems) {
          @if (filteredMenuItems(menuItems); as visibleItems) {
            <div class="menu-list-header">
              <p>מציג {{ visibleItems.length }} מתוך {{ menuItems.length }} מנות</p>
            </div>

            @if (!menuItems.length) {
              <div class="empty-state">
                <h2>לא נמצאו מנות</h2>
              </div>
            } @else if (visibleItems.length) {
              <div class="resource-grid menu-management-grid">
                @for (item of visibleItems; track item.id) {
                  <article class="resource-card menu-admin-card">
                    <img [src]="item.images[0]" [alt]="item.name" loading="lazy" />
                    <div class="menu-card-body">
                      <div class="inline-between menu-card-meta">
                        <app-status-badge [label]="categoryName(item)" tone="gold" />
                        <app-status-badge [label]="item.isAvailable ? 'זמין' : 'לא זמין'" [tone]="item.isAvailable ? 'olive' : 'charcoal'" />
                      </div>
                      <div class="inline-between menu-card-title-row">
                        <h3>{{ item.name }}</h3>
                        <strong>{{ item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
                      </div>
                      <p class="muted menu-card-description">{{ item.description }}</p>
                      <div class="actions-inline menu-card-actions">
                        <button type="button" class="btn btn-small btn-ghost" [disabled]="isActing(item.id)" [routerLink]="['/admin/menu', item.id, 'edit']">עריכה</button>
                        <button type="button" class="btn btn-small" [class.btn-olive]="!item.isAvailable" [class.btn-ghost]="item.isAvailable" [disabled]="isActing(item.id)" (click)="toggle(item)">
                          {{ item.isAvailable ? 'הסתרה' : 'החזרה' }}
                        </button>
                        <button type="button" class="btn btn-small btn-danger" [disabled]="isActing(item.id)" (click)="delete(item.id)">מחיקה</button>
                      </div>
                    </div>
                  </article>
                }
              </div>
            } @else {
              <div class="empty-state">
                <h2>לא נמצאו מנות מתאימות</h2>
              </div>
            }
          }
        } @else {
          <div class="empty-state">
            <h2>טוען מנות...</h2>
          </div>
        }
      } @else {
        <div class="empty-state">
          <h2>טוען קטגוריות...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .menu-toolbar {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(170px, 220px) minmax(140px, 180px) auto;
      align-items: end;
      gap: 1rem;
      margin-bottom: 0.9rem;
    }

    .toolbar-actions {
      align-items: end;
      justify-content: flex-end;
    }

    .form-kicker {
      margin: 0 0 0.2rem;
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 800;
    }

    .category-management {
      display: grid;
      gap: 1.1rem;
      margin-bottom: 1rem;
    }

    .category-management__header {
      align-items: flex-start;
      gap: 1rem;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--line);
    }

    .category-management__header h2 {
      margin: 0;
      font-size: 1.35rem;
    }

    .category-panel-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }

    .category-editor-card,
    .category-list-card {
      display: grid;
      gap: 0.85rem;
      min-width: 0;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.72);
    }

    .category-section-heading h3 {
      margin: 0;
      font-size: 1rem;
    }

    .category-editor-card label:not(.category-active-control) {
      display: grid;
      gap: 0.35rem;
    }

    .category-active-control {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      width: fit-content;
      font-weight: 800;
    }

    .category-active-control input {
      width: 18px;
      height: 18px;
      accent-color: var(--olive);
    }

    .category-form-actions {
      justify-content: flex-start;
    }

    .category-list {
      max-height: 320px;
      overflow: auto;
      padding-inline-end: 0.25rem;
    }

    .category-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 1rem;
      padding-block: 0.65rem;
    }

    .category-row + .category-row {
      border-top: 1px solid var(--line);
    }

    .category-row-main {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      min-width: 0;
      flex-wrap: wrap;
    }

    .category-row-main span {
      min-width: 0;
      overflow-wrap: anywhere;
      font-weight: 900;
    }

    .category-actions {
      justify-content: flex-end;
    }

    .category-delete-button {
      color: var(--danger);
      border-color: rgba(161, 58, 42, 0.24);
    }

    .category-empty-state {
      padding: 1rem;
      border: 1px dashed var(--line);
      border-radius: var(--radius);
      color: var(--muted);
      font-weight: 800;
      text-align: center;
    }

    .menu-list-header {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 800;
      margin-block: 0.8rem;
    }

    .menu-list-header p {
      margin: 0;
    }

    .menu-management-grid {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }

    .menu-admin-card {
      overflow: hidden;
      display: grid;
      gap: 0;
      min-width: 0;
    }

    .menu-admin-card img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: 0;
    }

    .menu-card-body {
      display: grid;
      gap: 0.65rem;
      padding: 14px;
    }

    .menu-card-meta,
    .menu-card-title-row {
      gap: 0.75rem;
      align-items: flex-start;
    }

    .menu-card-title-row h3,
    .menu-card-description {
      margin: 0;
    }

    .menu-card-title-row h3 {
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 1.08rem;
    }

    .menu-card-description {
      display: -webkit-box;
      min-height: 2.7em;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .menu-card-actions {
      padding-top: 0.25rem;
    }

    @media (max-width: 1020px) {
      .menu-toolbar {
        grid-template-columns: 1fr 1fr;
      }

      .toolbar-actions {
        justify-content: flex-start;
      }

      .category-panel-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .menu-toolbar,
      .menu-management-grid {
        grid-template-columns: 1fr;
      }

      .toolbar-actions,
      .toolbar-actions .btn,
      .category-row .btn {
        width: 100%;
      }

      .menu-list-header {
        justify-content: flex-start;
      }

      .category-row,
      .category-actions {
        align-items: stretch;
      }

      .category-management__header,
      .category-row {
        grid-template-columns: 1fr;
      }

      .category-management__header {
        flex-direction: column;
      }

      .category-management__header .btn,
      .category-form-actions .btn,
      .category-actions .btn,
      .category-section-heading .btn {
        width: 100%;
      }
    }
  `]
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
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    isActive: [true]
  });

  editingCategoryId: number | null = null;
  actingItemId: number | null = null;
  deletingCategoryId: number | null = null;
  isCategoryPanelOpen = false;
  isCategoryFormOpen = false;
  isCategorySubmitting = false;
  errorMessage = '';
  categoryErrorMessage = '';
  categorySuccessMessage = '';
  categoryFormSubmitted = false;
  searchTerm = '';
  categoryFilter: number | 'all' = 'all';
  availabilityFilter: 'all' | 'available' | 'unavailable' = 'all';

  toggleCategoryPanel(): void {
    this.isCategoryPanelOpen = !this.isCategoryPanelOpen;
    if (!this.isCategoryPanelOpen) {
      this.resetCategoryForm();
    }
  }

  startCreateCategory(): void {
    if (this.isCategorySubmitting) {
      return;
    }

    this.isCategoryFormOpen = true;
    this.editingCategoryId = null;
    this.categoryErrorMessage = '';
    this.categorySuccessMessage = '';
    this.categoryFormSubmitted = false;
    this.categoryForm.reset({
      name: '',
      isActive: true
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

    const value = this.categoryForm.getRawValue();
    const categoryName = value.name.trim();
    if (this.categoryNameExists(categoryName)) {
      this.categoryErrorMessage = 'כבר קיימת קטגוריה בשם הזה.';
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.isCategorySubmitting = true;
    this.categoryErrorMessage = '';
    this.categorySuccessMessage = '';
    const input = {
      name: categoryName,
      isActive: value.isActive
    };
    const wasEditing = this.editingCategoryId !== null;
    const request$ = this.editingCategoryId
      ? this.data.updateMenuCategory(this.editingCategoryId, input)
      : this.data.createMenuCategory(input);

    request$.pipe(
      finalize(() => {
        this.isCategorySubmitting = false;
      })
    ).subscribe({
      next: () => {
        this.resetCategoryForm();
        this.categorySuccessMessage = wasEditing ? 'הקטגוריה עודכנה בהצלחה' : 'הקטגוריה נוצרה בהצלחה';
      },
      error: () => {
        this.categoryErrorMessage = 'לא הצלחנו לשמור את הקטגוריה. נסו שוב בעוד רגע.';
      }
    });
  }

  editCategory(category: MenuCategoryRecord): void {
    if (this.isCategorySubmitting) {
      return;
    }

    this.isCategoryPanelOpen = true;
    this.isCategoryFormOpen = true;
    this.editingCategoryId = category.id;
    this.categoryErrorMessage = '';
    this.categorySuccessMessage = '';
    this.categoryFormSubmitted = false;
    this.categoryForm.reset({
      name: category.name,
      isActive: category.isActive
    });
  }

  resetCategoryForm(): void {
    this.isCategoryFormOpen = false;
    this.editingCategoryId = null;
    this.categoryFormSubmitted = false;
    this.categoryErrorMessage = '';
    this.categoryForm.reset({
      name: '',
      isActive: true
    });
  }

  deleteCategory(category: MenuCategoryRecord): void {
    if (this.deletingCategoryId !== null) {
      return;
    }

    this.deletingCategoryId = category.id;
    this.categoryErrorMessage = '';
    this.categorySuccessMessage = '';
    this.data.deleteMenuCategory(category.id).pipe(
      finalize(() => {
        this.deletingCategoryId = null;
      })
    ).subscribe({
      next: () => {
        this.categorySuccessMessage = 'הקטגוריה נמחקה בהצלחה';
        this.resetCategoryForm();
      },
      error: (error: unknown) => {
        this.categoryErrorMessage = this.categoryDeleteErrorMessage(error);
      }
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
      error: () => {
        this.errorMessage = 'לא הצלחנו למחוק את המנה. נסו שוב בעוד רגע.';
      }
    });
  }

  isActing(id: number): boolean {
    return this.actingItemId === id;
  }

  isDeletingCategory(id: number): boolean {
    return this.deletingCategoryId === id;
  }

  setCategoryFilter(value: string): void {
    this.categoryFilter = value === 'all' ? 'all' : Number(value);
  }

  categoryFilterValue(): string {
    return this.categoryFilter === 'all' ? 'all' : this.categoryValue(this.categoryFilter);
  }

  categoryValue(categoryId: number): string {
    return String(categoryId);
  }

  setAvailabilityFilter(value: string): void {
    this.availabilityFilter = value === 'available' || value === 'unavailable' ? value : 'all';
  }

  filteredMenuItems(items: MenuItem[]): MenuItem[] {
    const search = this.normalizeSearch(this.searchTerm);

    return items.filter((item) => {
      if (this.categoryFilter !== 'all' && item.category !== this.categoryFilter) {
        return false;
      }

      if (this.availabilityFilter === 'available' && !item.isAvailable) {
        return false;
      }

      if (this.availabilityFilter === 'unavailable' && item.isAvailable) {
        return false;
      }

      if (!search) {
        return true;
      }

      return `${item.name} ${item.description}`.toLowerCase().includes(search);
    });
  }

  menuItemCreationBlocked(categories = this.latestCategories): boolean {
    return !categories.some((category) => category.isActive);
  }

  categoryName(item: MenuItem): string {
    return item.categoryName || categoryLabels[item.category as MenuCategory] || `קטגוריה ${item.category}`;
  }

  categoryFieldError(controlName: keyof typeof this.categoryForm.controls): string {
    return controlError(this.categoryForm.controls[controlName], this.categoryFormSubmitted);
  }

  private categoryNameExists(name: string): boolean {
    const normalizedName = this.normalizeSearch(name);
    return this.latestCategories.some((category) =>
      category.id !== this.editingCategoryId && this.normalizeSearch(category.name) === normalizedName
    );
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }

  private categoryDeleteErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      return 'לא ניתן למחוק קטגוריה שיש בה מנות. ניתן להפוך אותה ללא פעילה.';
    }

    return 'לא הצלחנו למחוק את הקטגוריה';
  }
}
