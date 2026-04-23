import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MenuCategory } from '../../core/models';
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
        subtitle="יצירה ועריכה ב-mock, כולל תמונת preview וזמינות לפרסום בתפריט הציבורי."
      />

      <div class="management-layout">
        <form class="panel form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <h2 class="full">מנה חדשה</h2>
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
          <button class="btn btn-gold full" type="submit" [disabled]="form.invalid">שמירת מנה mock</button>
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
              <button type="button" class="btn btn-small" [class.btn-olive]="!item.isAvailable" [class.btn-ghost]="item.isAvailable" (click)="toggle(item.id)">
                {{ item.isAvailable ? 'הסתרה מהתפריט' : 'החזרה לתפריט' }}
              </button>
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
    imageUrl: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80', Validators.required]
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    this.data.createMenuItem({
      name: value.name,
      description: value.description,
      price: value.price,
      category: value.category,
      isAvailable: value.isAvailable,
      images: [value.imageUrl]
    });
    this.form.patchValue({ name: '', description: '' });
  }

  toggle(id: number): void {
    this.data.toggleMenuAvailability(id);
  }
}
