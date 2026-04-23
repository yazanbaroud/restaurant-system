import { CurrencyPipe } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <article
      class="stat-card"
      [class.stat-card--gold]="accent === 'gold'"
      [class.stat-card--olive]="accent === 'olive'"
      [class.stat-card--burgundy]="accent === 'burgundy'"
      [class.stat-card--stone]="accent === 'stone'"
    >
      <div class="stat-card__icon" aria-hidden="true">{{ icon }}</div>
      <div>
        <p>{{ label }}</p>
        <strong>
          @if (currency) {
            {{ value | currency: 'ILS' : 'symbol' : '1.0-0' }}
          } @else {
            {{ value }}
          }
        </strong>
      </div>
    </article>
  `
})
export class StatCardComponent {
  @Input() icon = '₪';
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() currency = false;
  @Input() accent: 'gold' | 'olive' | 'burgundy' | 'stone' = 'stone';
}
