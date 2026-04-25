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
            <button type="button" class="btn btn-small btn-gold" [disabled]="!item.isAvailable" (click)="add.emit(item)">
              הוספה
            </button>
          }
        </div>
      </div>
    </article>
  `
})
export class MenuItemCardComponent {
  @Input({ required: true }) item!: MenuItem;
  @Input() showAdd = false;
  @Output() add = new EventEmitter<MenuItem>();

  readonly categoryLabels = categoryLabels;

  get categoryName(): string {
    return this.item.categoryName || this.categoryLabels[this.item.category as MenuCategory] || `קטגוריה ${this.item.category}`;
  }
}
