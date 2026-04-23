import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ReservationCardComponent } from '../../shared/components/reservation-card.component';

@Component({
  selector: 'app-waiter-reservations-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, ReservationCardComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="קריאה בלבד"
        title="הזמנות מקום להיום ומחר"
        subtitle="המלצר רואה את הלו״ז התפעולי, ללא ניהול או דוחות."
      />
      <div class="resource-grid">
        @for (reservation of reservations$ | async; track reservation.id) {
          <app-reservation-card [reservation]="reservation" />
        }
      </div>
    </section>
  `
})
export class WaiterReservationsPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly reservations$ = this.data.getReservations();
}
