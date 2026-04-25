import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Reservation, ReservationStatus } from '../../core/models';
import { reservationStatusLabels, reservationStatusTones } from '../ui-labels';
import { StatusBadgeComponent } from './status-badge.component';

export interface ReservationStatusChange {
  status: ReservationStatus;
  restaurantNotes?: string;
}

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <article class="resource-card reservation-card">
      <div class="inline-between">
        <div>
          <p class="eyebrow">{{ reservation.reservationDate }} · {{ reservation.reservationTime }}</p>
          <h3>{{ reservation.customerFirstName }} {{ reservation.customerLastName }}</h3>
        </div>
        <app-status-badge
          [label]="reservationStatusLabels[reservation.status]"
          [tone]="reservationStatusTones[reservation.status]"
        />
      </div>
      <div class="reservation-card__meta">
        <span>{{ reservation.guestCount }} סועדים</span>
        <span>{{ reservation.phoneNumber }}</span>
      </div>
      @if (reservation.notes) {
        <p class="muted">{{ reservation.notes }}</p>
      }
      @if (reservation.restaurantNotes) {
        <p class="note">הערת מסעדה: {{ reservation.restaurantNotes }}</p>
      }
      @if (showActions && reservation.status === ReservationStatus.Pending) {
        @if (isRejecting) {
          <div class="reservation-card__rejection">
            <label>
              סיבת דחייה
              <textarea
                rows="3"
                [value]="rejectionReason"
                placeholder="לדוגמה: אין שולחן פנוי בשעה המבוקשת"
                (input)="updateRejectionReason($event)"
              ></textarea>
            </label>
            @if (rejectionError) {
              <p class="validation-note">נא להזין סיבת דחייה לפני שליחה.</p>
            }
            <div class="actions-inline">
              <button type="button" class="btn btn-small btn-danger" (click)="submitRejection()">דחיית ההזמנה</button>
              <button type="button" class="btn btn-small btn-ghost" (click)="cancelRejection()">ביטול</button>
            </div>
          </div>
        } @else {
          <div class="actions-inline">
            <button type="button" class="btn btn-small btn-olive" (click)="approve()">אישור</button>
            <button type="button" class="btn btn-small btn-ghost" (click)="startRejection()">דחייה</button>
          </div>
        }
      }
    </article>
  `
})
export class ReservationCardComponent {
  @Input({ required: true }) reservation!: Reservation;
  @Input() showActions = false;
  @Output() statusChange = new EventEmitter<ReservationStatusChange>();

  readonly ReservationStatus = ReservationStatus;
  readonly reservationStatusLabels = reservationStatusLabels;
  readonly reservationStatusTones = reservationStatusTones;

  isRejecting = false;
  rejectionReason = '';
  rejectionError = false;

  approve(): void {
    this.statusChange.emit({ status: ReservationStatus.Approved });
  }

  startRejection(): void {
    this.isRejecting = true;
    this.rejectionError = false;
  }

  cancelRejection(): void {
    this.isRejecting = false;
    this.rejectionReason = '';
    this.rejectionError = false;
  }

  updateRejectionReason(event: Event): void {
    this.rejectionReason = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    if (this.rejectionReason.trim()) {
      this.rejectionError = false;
    }
  }

  submitRejection(): void {
    const restaurantNotes = this.rejectionReason.trim();
    if (!restaurantNotes) {
      this.rejectionError = true;
      return;
    }

    this.statusChange.emit({
      status: ReservationStatus.Rejected,
      restaurantNotes
    });
  }
}
