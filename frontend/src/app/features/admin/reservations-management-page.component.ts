import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { Reservation, ReservationStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ReservationCardComponent } from '../../shared/components/reservation-card.component';
import { reservationStatusLabels } from '../../shared/ui-labels';

type ReservationFilter = 'all' | ReservationStatus;

@Component({
  selector: 'app-reservations-management-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, ReservationCardComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="ניהול הזמנות מקום"
        title="בקשות ואישורי שולחנות"
        subtitle="אישור או דחייה הם mock בלבד כרגע, אבל משנים את מצב הרשומה."
      />
      <div class="segmented-control">
        @for (filter of filters; track filter.value) {
          <button type="button" [class.active]="selectedFilter === filter.value" (click)="selectedFilter = filter.value">
            {{ filter.label }}
          </button>
        }
      </div>
      @if (reservations$ | async; as reservations) {
        <div class="resource-grid">
          @for (reservation of filteredReservations(reservations); track reservation.id) {
            <app-reservation-card
              [reservation]="reservation"
              [showActions]="true"
              (statusChange)="setStatus(reservation.id, $event)"
            />
          }
        </div>
      }
    </section>
  `
})
export class ReservationsManagementPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly reservations$ = this.data.getReservations();
  readonly filters: { value: ReservationFilter; label: string }[] = [
    { value: 'all', label: 'הכל' },
    { value: ReservationStatus.Pending, label: reservationStatusLabels[ReservationStatus.Pending] },
    { value: ReservationStatus.Approved, label: reservationStatusLabels[ReservationStatus.Approved] },
    { value: ReservationStatus.Rejected, label: reservationStatusLabels[ReservationStatus.Rejected] },
    { value: ReservationStatus.Cancelled, label: reservationStatusLabels[ReservationStatus.Cancelled] }
  ];

  selectedFilter: ReservationFilter = 'all';

  filteredReservations(reservations: Reservation[]): Reservation[] {
    if (this.selectedFilter === 'all') {
      return reservations;
    }

    return reservations.filter((reservation) => reservation.status === this.selectedFilter);
  }

  setStatus(id: number, status: ReservationStatus): void {
    this.data.updateReservationStatus(id, status, status === ReservationStatus.Approved ? 'אושר במערכת הניהול' : 'נדחה במערכת הניהול');
  }
}
