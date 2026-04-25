import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { finalize } from 'rxjs';

import { Reservation, ReservationStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ReservationCardComponent, ReservationStatusChange } from '../../shared/components/reservation-card.component';
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
        subtitle="אישור ודחייה של הזמנות מקום מול מערכת המסעדה בזמן אמת."
      />
      <div class="segmented-control">
        @for (filter of filters; track filter.value) {
          <button type="button" [class.active]="selectedFilter === filter.value" (click)="selectedFilter = filter.value">
            {{ filter.label }}
          </button>
        }
      </div>
      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }
      @if (reservations$ | async; as reservations) {
        <div class="resource-grid">
          @for (reservation of filteredReservations(reservations); track reservation.id) {
            <app-reservation-card
              [reservation]="reservation"
              [showActions]="!isUpdating(reservation.id)"
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
  updatingReservationId: number | null = null;
  errorMessage = '';

  filteredReservations(reservations: Reservation[]): Reservation[] {
    if (this.selectedFilter === 'all') {
      return reservations;
    }

    return reservations.filter((reservation) => reservation.status === this.selectedFilter);
  }

  setStatus(id: number, change: ReservationStatusChange): void {
    if (this.updatingReservationId !== null) {
      return;
    }

    const restaurantNotes = change.restaurantNotes?.trim() || this.restaurantNoteForStatus(change.status);
    if (change.status === ReservationStatus.Rejected && !restaurantNotes) {
      this.errorMessage = 'נא להזין סיבת דחייה לפני עדכון ההזמנה.';
      return;
    }

    this.updatingReservationId = id;
    this.errorMessage = '';
    this.data.updateReservationStatus(id, change.status, restaurantNotes).pipe(
      finalize(() => {
        this.updatingReservationId = null;
      })
    ).subscribe({
      error: () => {
        this.errorMessage = 'לא הצלחנו לעדכן את סטטוס ההזמנה. נסו שוב בעוד רגע.';
      }
    });
  }

  isUpdating(id: number): boolean {
    return this.updatingReservationId === id;
  }

  private restaurantNoteForStatus(status: ReservationStatus): string {
    const notes: Partial<Record<ReservationStatus, string>> = {
      [ReservationStatus.Approved]: 'אושר במערכת הניהול',
      [ReservationStatus.Cancelled]: 'בוטל במערכת הניהול',
      [ReservationStatus.Arrived]: 'הלקוח הגיע למסעדה',
      [ReservationStatus.NoShow]: 'הלקוח לא הגיע'
    };

    return notes[status] ?? '';
  }
}
