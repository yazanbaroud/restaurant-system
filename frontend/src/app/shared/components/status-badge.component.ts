import { Component, Input } from '@angular/core';

import { BadgeTone } from '../ui-labels';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="status-badge"
      [class.status-badge--gold]="tone === 'gold'"
      [class.status-badge--olive]="tone === 'olive'"
      [class.status-badge--burgundy]="tone === 'burgundy'"
      [class.status-badge--charcoal]="tone === 'charcoal'"
      [class.status-badge--beige]="tone === 'beige'"
      [class.status-badge--danger]="tone === 'danger'"
    >
      {{ label }}
    </span>
  `
})
export class StatusBadgeComponent {
  @Input({ required: true }) label = '';
  @Input() tone: BadgeTone = 'beige';
}
