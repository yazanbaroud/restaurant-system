import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, shareReplay } from 'rxjs';

import { MenuCategory, MenuItem, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CustomerCartLine, CustomerCartService } from '../../core/services/customer-cart.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { MenuItemCardComponent } from '../../shared/components/menu-item-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { categoryLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-dish-details-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, MenuItemCardComponent, RouterLink, StatusBadgeComponent],
  template: `
    @if (item$ | async; as item) {
      <section class="dish-detail">
        <div class="dish-detail__media">
          <img [src]="item.images[0]" [alt]="item.name" />
        </div>
        <div class="dish-detail__content">
          <app-status-badge [label]="categoryName(item)" tone="gold" />
          <h1>{{ item.name }}</h1>
          <p>{{ item.description }}</p>
          <strong class="price price--large">{{ item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
          @if (shouldShowCartAction()) {
            <div class="dish-cart-panel">
              <div class="dish-quantity-control" aria-label="כמות להוספה">
                <button type="button" aria-label="הפחתת כמות" (click)="decreaseSelectedQuantity()">−</button>
                <span>{{ selectedQuantity }}</span>
                <button type="button" aria-label="הגדלת כמות" (click)="increaseSelectedQuantity()">+</button>
              </div>
              @if (cart.lines$ | async; as cartLines) {
                @if (quantityInCart(item.id, cartLines); as cartQuantity) {
                  <span class="dish-cart-count">בעגלה: {{ cartQuantity }}</span>
                }
              }
            </div>
          }
          @if (cartMessage) {
            <p class="success-note">{{ cartMessage }}</p>
          }
          <div class="actions-inline">
            @if (shouldShowCartAction()) {
              <button type="button" class="btn btn-gold" (click)="addToCart(item)">הוספה לעגלה</button>
            }
            <a class="btn btn-gold" routerLink="/reservation">הזמנת שולחן</a>
            <a class="btn btn-ghost" routerLink="/menu">חזרה לתפריט</a>
          </div>
        </div>
      </section>

      <section class="section container">
        <div class="section-heading">
          <p class="eyebrow">עוד מהקטגוריה</p>
          <h2>{{ categoryName(item) }}</h2>
        </div>
        <div class="menu-grid">
          @for (related of relatedItems$ | async; track related.id) {
            <app-menu-item-card [item]="related" />
          }
        </div>
      </section>
    } @else {
      <section class="container empty-state">
        <h1>המנה לא נמצאה</h1>
        <a class="btn btn-dark" routerLink="/menu">חזרה לתפריט</a>
      </section>
    }
  `,
  styles: [`
    .dish-cart-panel {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      flex-wrap: wrap;
      margin-block: 0 16px;
    }

    .dish-quantity-control {
      display: inline-grid;
      grid-template-columns: 42px 46px 42px;
      align-items: center;
      justify-items: center;
      overflow: hidden;
      border: 1px solid rgba(255, 248, 237, 0.28);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.12);
    }

    .dish-quantity-control button {
      width: 42px;
      height: 42px;
      border: 0;
      background: rgba(255, 248, 237, 0.16);
      color: var(--ivory);
      cursor: pointer;
      font-weight: 950;
    }

    .dish-quantity-control span,
    .dish-cart-count {
      color: var(--ivory);
      font-weight: 900;
    }
  `]
})
export class DishDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(RestaurantDataService);
  private readonly auth = inject(AuthService);
  readonly cart = inject(CustomerCartService);
  private readonly router = inject(Router);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly item$ = this.data.getMenuItem(this.id).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  readonly relatedItems$ = combineLatest([this.item$, this.data.getAvailableMenuItems()]).pipe(
    map(([item, items]) =>
      item ? items.filter((related) => related.category === item.category && related.id !== item.id).slice(0, 3) : []
    )
  );
  readonly categoryLabels = categoryLabels;
  cartMessage = '';
  selectedQuantity = 1;

  categoryName(item: MenuItem): string {
    return item.categoryName || categoryLabels[item.category as MenuCategory] || `קטגוריה ${item.category}`;
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
    this.cart.addItem(item, this.selectedQuantity);
    this.cartMessage = currentQuantity
      ? `הכמות של ${item.name} עודכנה ל-${currentQuantity + this.selectedQuantity}`
      : `${item.name} נוספה לעגלה`;
  }

  increaseSelectedQuantity(): void {
    this.selectedQuantity += 1;
  }

  decreaseSelectedQuantity(): void {
    this.selectedQuantity = Math.max(1, this.selectedQuantity - 1);
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
