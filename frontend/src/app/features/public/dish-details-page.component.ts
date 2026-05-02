import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, shareReplay, startWith } from 'rxjs';

import { MenuCategory, MenuItem } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
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
  imports: [AsyncPipe, CurrencyPipe, MenuItemCardComponent, RouterLink, StatusBadgeComponent],
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

            <div class="actions-inline">
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
              <app-menu-item-card [item]="related" />
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
      .dish-detail-skeleton--content {
        margin: 18px;
      }
    }
  `]
})
export class DishDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(RestaurantDataService);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

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

  categoryName(item: MenuItem): string {
    return item.categoryName || categoryLabels[item.category as MenuCategory] || `קטגוריה ${item.category}`;
  }
}
