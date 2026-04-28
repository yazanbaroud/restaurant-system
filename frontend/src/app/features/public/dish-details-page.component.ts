import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, shareReplay, startWith } from 'rxjs';

import { MenuCategory, MenuItem, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CustomerCartLine, CustomerCartService } from '../../core/services/customer-cart.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { FloatingCartComponent } from '../../shared/components/floating-cart.component';
import { MenuItemCardComponent } from '../../shared/components/menu-item-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { categoryLabels } from '../../shared/ui-labels';

interface DishDetailsState {
  item: MenuItem | null;
  isLoading: boolean;
  hasError: boolean;
}

@Component({
  selector: 'app-dish-details-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, FloatingCartComponent, MenuItemCardComponent, RouterLink, StatusBadgeComponent],
  template: `
    @if (state$ | async; as state) {
      @if (state.isLoading) {
        <section class="dish-detail dish-detail--loading" aria-label="טוען מנה">
          <div class="dish-detail-skeleton dish-detail-skeleton--media"></div>
          <div class="dish-detail-skeleton dish-detail-skeleton--content"></div>
        </section>
      } @else if (state.item; as item) {
        <section class="dish-detail customer-dish-detail">
          <div class="dish-detail__media">
            <img [src]="item.images[0]" [alt]="item.name" />
          </div>
          <div class="dish-detail__content">
            <div class="dish-detail__topline">
              <app-status-badge [label]="categoryName(item)" tone="gold" />
              <strong class="price price--large">{{ item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
            </div>

            <h1>{{ item.name }}</h1>
            <p>{{ item.description }}</p>

            @if (shouldShowCartAction()) {
              <div class="dish-order-panel">
                <div>
                  <span class="dish-order-panel__label">כמות להוספה</span>
                  <div class="dish-quantity-control" aria-label="כמות להוספה">
                    <button type="button" aria-label="הפחתת כמות" (click)="decreaseSelectedQuantity()">−</button>
                    <span>{{ selectedQuantity }}</span>
                    <button type="button" aria-label="הגדלת כמות" (click)="increaseSelectedQuantity()">+</button>
                  </div>
                </div>

                @if (cart.lines$ | async; as cartLines) {
                  <div class="dish-cart-state">
                    <span>בעגלה עכשיו</span>
                    <strong>{{ quantityInCart(item.id, cartLines) }}</strong>
                  </div>
                }

                <button type="button" class="btn btn-gold dish-add-button" (click)="addToCart(item)">
                  הוספה לעגלה
                </button>
              </div>
            }

            @if (cartMessage) {
              <p class="success-note dish-feedback" role="status">{{ cartMessage }}</p>
            }

            <div class="actions-inline">
              @if (shouldShowCartAction()) {
                <button type="button" class="btn btn-dark" (click)="openCart()">מעבר לעגלה</button>
              }
              <a class="btn btn-gold" routerLink="/reservation">הזמנת שולחן</a>
              <a class="btn btn-ghost" routerLink="/menu">חזרה לתפריט</a>
            </div>
          </div>
        </section>

        <section class="section container">
          <div class="section-heading">
            <div>
              <p class="eyebrow">עוד מהקטגוריה</p>
              <h2>{{ categoryName(item) }}</h2>
            </div>
          </div>
          <div class="menu-grid">
            @for (related of relatedItems$ | async; track related.id) {
              <app-menu-item-card [item]="related" [showAdd]="shouldShowCartAction()" (add)="addToCart(related)" />
            }
          </div>
        </section>
      } @else {
        <section class="container empty-state">
          <h1>{{ state.hasError ? 'לא הצלחנו לטעון את המנה' : 'המנה לא נמצאה' }}</h1>
          <p>אפשר לחזור לתפריט ולבחור מנה אחרת.</p>
          <a class="btn btn-dark" routerLink="/menu">חזרה לתפריט</a>
        </section>
      }
    }
    <app-floating-cart />
  `,
  styles: [`
    .customer-dish-detail {
      overflow: hidden;
    }

    .dish-detail__topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }

    .dish-order-panel {
      display: grid;
      grid-template-columns: auto minmax(100px, 1fr) auto;
      gap: 14px;
      align-items: end;
      margin-block: 24px 16px;
      padding: 14px;
      border: 1px solid rgba(255, 248, 237, 0.2);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.1);
    }

    .dish-order-panel__label,
    .dish-cart-state span {
      display: block;
      margin-bottom: 7px;
      color: rgba(255, 248, 237, 0.72);
      font-weight: 850;
    }

    .dish-quantity-control {
      display: inline-grid;
      grid-template-columns: 46px 52px 46px;
      align-items: center;
      justify-items: center;
      overflow: hidden;
      border: 1px solid rgba(255, 248, 237, 0.28);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.12);
    }

    .dish-quantity-control button {
      width: 46px;
      height: 46px;
      border: 0;
      background: rgba(255, 248, 237, 0.16);
      color: var(--ivory);
      cursor: pointer;
      font-weight: 950;
      font-size: 1.15rem;
    }

    .dish-quantity-control span,
    .dish-cart-state strong {
      color: var(--ivory);
      font-weight: 950;
    }

    .dish-cart-state strong {
      font-size: 1.25rem;
    }

    .dish-add-button {
      min-width: 150px;
    }

    .dish-feedback {
      margin-bottom: 16px;
      padding: 10px 12px;
      border: 1px solid rgba(102, 112, 68, 0.22);
      border-radius: var(--radius);
      background: rgba(102, 112, 68, 0.16);
    }

    .dish-detail--loading {
      min-height: 520px;
      background: var(--brown-950);
    }

    .dish-detail-skeleton {
      min-height: 100%;
      border-radius: var(--radius);
      background: linear-gradient(110deg, rgba(255, 248, 237, 0.08), rgba(255, 248, 237, 0.18), rgba(255, 248, 237, 0.08));
      background-size: 220% 100%;
      animation: dishSkeleton 1.15s ease-in-out infinite;
    }

    .dish-detail-skeleton--content {
      min-height: 360px;
      margin: 48px;
    }

    @keyframes dishSkeleton {
      from { background-position: 100% 0; }
      to { background-position: -100% 0; }
    }

    @media (max-width: 920px) {
      .dish-order-panel {
        grid-template-columns: 1fr;
        align-items: stretch;
      }

      .dish-add-button {
        width: 100%;
      }

      .dish-detail-skeleton--content {
        margin: 18px;
      }
    }
  `]
})
export class DishDetailsPageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(RestaurantDataService);
  private readonly auth = inject(AuthService);
  readonly cart = inject(CustomerCartService);
  private readonly router = inject(Router);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  private feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly state$ = this.data.getMenuItem(this.id).pipe(
    map((item): DishDetailsState => ({ item: item ?? null, isLoading: false, hasError: false })),
    catchError(() => of({ item: null, isLoading: false, hasError: true })),
    startWith({ item: null, isLoading: true, hasError: false }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly relatedItems$ = combineLatest([this.state$, this.data.getAvailableMenuItems()]).pipe(
    map(([state, items]) =>
      state.item
        ? items.filter((related) => related.category === state.item?.category && related.id !== state.item.id).slice(0, 3)
        : []
    )
  );
  readonly categoryLabels = categoryLabels;
  cartMessage = '';
  selectedQuantity = 1;

  ngOnDestroy(): void {
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }
  }

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

  openCart(): void {
    if (!this.canManageCart()) {
      this.redirectToLogin('/cart');
      return;
    }

    void this.router.navigate(['/cart']);
  }

  addToCart(item: MenuItem): void {
    if (!this.canManageCart()) {
      this.redirectToLogin();
      return;
    }

    const currentQuantity = this.cart.quantityFor(item.id);
    this.cart.addItem(item, this.selectedQuantity);
    this.showCartFeedback(
      currentQuantity
        ? `הכמות של ${item.name} עודכנה ל-${currentQuantity + this.selectedQuantity}`
        : `${item.name} נוספה לעגלה`
    );
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

  private showCartFeedback(message: string): void {
    this.cartMessage = message;

    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
    }

    this.feedbackTimeout = setTimeout(() => {
      this.cartMessage = '';
    }, 2400);
  }

  private redirectToLogin(returnUrl = this.router.url): void {
    this.cartMessage = 'כדי להוסיף מנות לעגלה צריך להתחבר כלקוח.';
    void this.router.navigate(['/login'], {
      queryParams: {
        returnUrl,
        role: UserRole.Customer
      }
    });
  }
}
