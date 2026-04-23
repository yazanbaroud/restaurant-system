import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Table, TableStatus } from '../../core/models';
import { tableStatusLabels, tableStatusTones } from '../ui-labels';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-table-card',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <article class="table-card" [class.selected]="selected">
      <div class="inline-between">
        <h3>{{ table.name }}</h3>
        <app-status-badge [label]="tableStatusLabels[table.status]" [tone]="tableStatusTones[table.status]" />
      </div>
      <p>{{ table.capacity }} מקומות</p>
      @if (selectable) {
        <button type="button" class="btn btn-small" [class.btn-gold]="!selected" [class.btn-dark]="selected" (click)="select.emit(table)">
          {{ selected ? 'נבחר' : 'בחירה' }}
        </button>
      }
    </article>
  `
})
export class TableCardComponent {
  @Input({ required: true }) table!: Table;
  @Input() selectable = false;
  @Input() selected = false;
  @Output() select = new EventEmitter<Table>();

  readonly tableStatusLabels = tableStatusLabels;
  readonly tableStatusTones = tableStatusTones;
  readonly TableStatus = TableStatus;
}
