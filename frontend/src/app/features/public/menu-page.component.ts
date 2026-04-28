import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { MenuCategoryRecord, MenuItem, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CustomerCartLine, CustomerCartService } from '../../core/services/customer-cart.service';
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

      @if (cartMessage) {
        <p class="success-note">{{ cartMessage }}</p>
      }

      @if (cart.lines$ | async; as cartLines) {
        @if (menuItems$ | async; as items) {
          <div class="menu-grid">
            @for (item of visibleItems(items); track item.id) {
              <app-menu-item-card
                [item]="item"
                [showAdd]="shouldShowCartAction()"
                [showQuantityControls]="canManageCart()"
                [quantityInCart]="quantityInCart(item.id, cartLines)"
                (add)="addToCart($event)"
                (increment)="addToCart($event)"
                (decrement)="decrementItem($event)"
              />
            }
          </div>
        }
      }
    </section>
  `
})
export class MenuPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly auth = inject(AuthService);
  readonly cart = inject(CustomerCartService);
  private readonly router = inject(Router);

  readonly menuItems$ = this.data.getAvailableMenuItems();
  readonly categories$ = this.data.getMenuCategories();

  selectedCategory: CategoryFilter = 'all';
  cartMessage = '';

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

  shouldShowCartAction(): boolean {
    const role = this.auth.currentUser?.role;
    return !role || role === UserRole.Customer;
  }

  canManageCart(): boolean {
    return this.auth.currentUser?.role === UserRole.Customer;
  }

  addToCart(item: MenuItem): void {
    if (!this.canManageCart()) {
      this.redirectToLogin();
      return;
    }

    const currentQuantity = this.cart.quantityFor(item.id);
    this.cart.addItem(item);
    this.cartMessage = currentQuantity
      ? `הכמות של ${item.name} עודכנה ל-${currentQuantity + 1}`
      : `${item.name} נוספה לעגלה`;
  }

  decrementItem(item: MenuItem): void {
    if (!this.canManageCart()) {
      this.redirectToLogin();
      return;
    }

    const currentQuantity = this.cart.quantityFor(item.id);
    this.cart.updateQuantity(item.id, currentQuantity - 1);
    this.cartMessage = currentQuantity > 1
      ? `הכמות של ${item.name} עודכנה ל-${currentQuantity - 1}`
      : `${item.name} הוסרה מהעגלה`;
  }

  quantityInCart(menuItemId: number, lines: CustomerCartLine[]): number {
    return lines.find((line) => line.item.id === menuItemId)?.quantity ?? 0;
  }

  private redirectToLogin(): void {
    this.cartMessage = 'כדי להוסיף מנות לעגלה צריך להתחבר כלקוח.';
    void this.router.navigate(['/login'], {
      queryParams: {
        returnUrl: this.router.url,
        role: UserRole.Customer
      }
    });
  }
}
