import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Reservation, ReservationStatus } from '../../core/models';
import { reservationStatusLabels, reservationStatusTones } from '../ui-labels';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <article class="resource-card reservation-card">
      <div class="inline-between">
        <div>
          <p class="eyebrow">{{ reservation.reservationDate }} · {{ reservation.reservationTime }}</p>
          <h3>{{ reservation.firstName }} {{ reservation.lastName }}</h3>
        </div>
        <app-status-badge
          [label]="reservationStatusLabels[reservation.status]"
          [tone]="reservationStatusTones[reservation.status]"
        />
      </div>
      <div class="reservation-card__meta">
        <span>{{ reservation.guestsCount }} סועדים</span>
        <span>{{ reservation.phoneNumber }}</span>
      </div>
      @if (reservation.customerNotes) {
        <p class="muted">{{ reservation.customerNotes }}</p>
      }
      @if (reservation.restaurantNotes) {
        <p class="note">הערת מסעדה: {{ reservation.restaurantNotes }}</p>
      }
      @if (showActions && reservation.status === ReservationStatus.Pending) {
        <div class="actions-inline">
          <button type="button" class="btn btn-small btn-olive" (click)="statusChange.emit(ReservationStatus.Approved)">אישור</button>
          <button type="button" class="btn btn-small btn-ghost" (click)="statusChange.emit(ReservationStatus.Rejected)">דחייה</button>
        </div>
      }
    </article>
  `
})
export class ReservationCardComponent {
  @Input({ required: true }) reservation!: Reservation;
  @Input() showActions = false;
  @Output() statusChange = new EventEmitter<ReservationStatus>();

  readonly ReservationStatus = ReservationStatus;
  readonly reservationStatusLabels = reservationStatusLabels;
  readonly reservationStatusTones = reservationStatusTones;
}
