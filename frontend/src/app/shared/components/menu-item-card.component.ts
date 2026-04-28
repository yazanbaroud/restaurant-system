import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MenuCategory, MenuItem } from '../../core/models';
import { categoryLabels } from '../ui-labels';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-menu-item-card',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, StatusBadgeComponent],
  template: `
    <article class="menu-card">
      <a class="menu-card__image" [routerLink]="['/menu', item.id]">
        <img [src]="item.images[0]" [alt]="item.name" loading="lazy" />
      </a>
      <div class="menu-card__body">
        <div class="inline-between">
          <app-status-badge [label]="categoryName" tone="gold" />
          <strong class="price">{{ item.price | currency: 'ILS' : 'symbol' : '1.0-0' }}</strong>
        </div>
        <h3>{{ item.name }}</h3>
        <p>{{ item.description }}</p>
        <div class="inline-between">
          <a class="text-link" [routerLink]="['/menu', item.id]">פרטי מנה</a>
          @if (showAdd) {
            @if (showQuantityControls && quantityInCart > 0) {
              <div class="menu-card__stepper" aria-label="כמות בעגלה">
                <button type="button" aria-label="הפחתת כמות" (click)="decrement.emit(item)">−</button>
                <span>{{ quantityInCart }}</span>
                <button type="button" aria-label="הגדלת כמות" (click)="increment.emit(item)">+</button>
              </div>
            } @else {
              <button type="button" class="btn btn-small btn-gold" [disabled]="!item.isAvailable" (click)="add.emit(item)">
                הוספה
              </button>
            }
          }
        </div>
      </div>
    </article>
  `,
  styles: [`
    .menu-card__stepper {
      display: inline-grid;
      grid-template-columns: 34px 36px 34px;
      align-items: center;
      justify-items: center;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.6);
    }

    .menu-card__stepper button {
      width: 34px;
      height: 34px;
      border: 0;
      background: rgba(31, 21, 17, 0.08);
      color: var(--brown-950);
      cursor: pointer;
      font-weight: 950;
    }

    .menu-card__stepper span {
      color: var(--brown-950);
      font-weight: 900;
    }
  `]
})
export class MenuItemCardComponent {
  @Input({ required: true }) item!: MenuItem;
  @Input() showAdd = false;
  @Input() showQuantityControls = false;
  @Input() quantityInCart = 0;
  @Output() add = new EventEmitter<MenuItem>();
  @Output() increment = new EventEmitter<MenuItem>();
  @Output() decrement = new EventEmitter<MenuItem>();

  readonly categoryLabels = categoryLabels;

  get categoryName(): string {
    return this.item.categoryName || this.categoryLabels[this.item.category as MenuCategory] || `קטגוריה ${this.item.category}`;
  }
}
