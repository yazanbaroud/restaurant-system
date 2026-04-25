import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MenuCategoryRecord, MenuItem } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { MenuItemCardComponent } from '../../shared/components/menu-item-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type CategoryFilter = number | 'all';

@Component({
  selector: 'app-menu-page',
  standalone: true,
  imports: [AsyncPipe, MenuItemCardComponent, PageHeaderComponent, RouterLink],
  template: `
    <section class="container page-surface">
      <app-page-header
        eyebrow="תפריט ציבורי"
        title="תפריט מסעדת הכבש"
        subtitle="מנות זמינות בלבד, מסודרות לפי סלטים, עיקריות, דגים, בשרים, קינוחים ושתייה."
      >
        <a class="btn btn-gold" routerLink="/reservation">הזמנת מקום</a>
      </app-page-header>

      <div class="segmented-control">
        @if (categories$ | async; as categories) {
          @for (category of categoryFilters(categories); track category.value) {
            <button
              type="button"
              [class.active]="selectedCategory === category.value"
              (click)="selectedCategory = category.value"
            >
              {{ category.label }}
            </button>
          }
        }
      </div>

      @if (menuItems$ | async; as items) {
        <div class="menu-grid">
          @for (item of visibleItems(items); track item.id) {
            <app-menu-item-card [item]="item" />
          }
        </div>
      }
    </section>
  `
})
export class MenuPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly menuItems$ = this.data.getAvailableMenuItems();
  readonly categories$ = this.data.getMenuCategories();

  selectedCategory: CategoryFilter = 'all';

  visibleItems(items: MenuItem[]): MenuItem[] {
    if (this.selectedCategory === 'all') {
      return items;
    }

    return items.filter((item) => item.category === this.selectedCategory);
  }

  categoryFilters(categories: MenuCategoryRecord[]): { value: CategoryFilter; label: string }[] {
    return [
      { value: 'all', label: 'הכל' },
      ...categories.map((category) => ({ value: category.id, label: category.name }))
    ];
  }
}
