import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, shareReplay } from 'rxjs';

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
          <app-status-badge [label]="categoryLabels[item.category]" tone="gold" />
          <h1>{{ item.name }}</h1>
          <p>{{ item.description }}</p>
          <strong class="price price--large">{{ item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
          <div class="actions-inline">
            <a class="btn btn-gold" routerLink="/reservation">הזמנת שולחן</a>
            <a class="btn btn-ghost" routerLink="/menu">חזרה לתפריט</a>
          </div>
        </div>
      </section>

      <section class="section container">
        <div class="section-heading">
          <p class="eyebrow">עוד מהקטגוריה</p>
          <h2>{{ categoryLabels[item.category] }}</h2>
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
  `
})
export class DishDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(RestaurantDataService);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly item$ = this.data.getMenuItem(this.id).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  readonly relatedItems$ = combineLatest([this.item$, this.data.getAvailableMenuItems()]).pipe(
    map(([item, items]) =>
      item ? items.filter((related) => related.category === item.category && related.id !== item.id).slice(0, 3) : []
    )
  );
  readonly categoryLabels = categoryLabels;
}
