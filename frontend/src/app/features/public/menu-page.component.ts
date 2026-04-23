import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MenuCategory, MenuItem } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { MenuItemCardComponent } from '../../shared/components/menu-item-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { categoryLabels } from '../../shared/ui-labels';

type CategoryFilter = MenuCategory | 'all';

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
        @for (category of categories; track category.value) {
          <button
            type="button"
            [class.active]="selectedCategory === category.value"
            (click)="selectedCategory = category.value"
          >
            {{ category.label }}
          </button>
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
  readonly categories: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'הכל' },
    ...Object.values(MenuCategory)
      .filter((value): value is MenuCategory => typeof value === 'number')
      .map((value) => ({ value, label: categoryLabels[value] }))
  ];

  selectedCategory: CategoryFilter = 'all';

  visibleItems(items: MenuItem[]): MenuItem[] {
    if (this.selectedCategory === 'all') {
      return items;
    }

    return items.filter((item) => item.category === this.selectedCategory);
  }
}
