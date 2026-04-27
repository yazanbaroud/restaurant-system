import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';

import { Reservation, ReservationStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ReservationCardComponent } from '../../shared/components/reservation-card.component';
import { reservationStatusLabels } from '../../shared/ui-labels';

type WaiterReservationStatusFilter = 'all' | ReservationStatus;

interface WaiterReservationDateRange {
  fromDate: string;
  toDate: string;
}

@Component({
  selector: 'app-waiter-reservations-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, ReservationCardComponent],
  template: `
    <section class="page-surface waiter-reservations-page">
      <app-page-header
        eyebrow="למשמרת"
        title="הזמנות מקום"
        subtitle="תצוגה תפעולית קצרה לשירות: מי מגיע, מתי, וכמה סועדים."
      />

      @if (reservations$ | async; as reservations) {
        <div class="panel waiter-reservations-toolbar">
          <label class="waiter-reservations-search">
            חיפוש
            <input
              #reservationSearch
              type="search"
              [value]="searchTerm"
              placeholder="חיפוש לפי שם או טלפון"
              autocomplete="off"
              (input)="searchTerm = reservationSearch.value"
            />
          </label>

          <label>
            מתאריך
            <input
              #reservationFromDate
              type="date"
              [value]="selectedFromDate"
              (change)="setFromDate(reservationFromDate.value)"
            />
          </label>

          <label>
            עד תאריך
            <input
              #reservationToDate
              type="date"
              [value]="selectedToDate"
              (change)="setToDate(reservationToDate.value)"
            />
          </label>

          <label>
            סטטוס
            <select #statusSelect [value]="statusFilterValue()" (change)="setStatusFilter(statusSelect.value)">
              @for (filter of statusFilters; track filter.value) {
                <option [value]="filterValue(filter.value)">{{ filter.label }}</option>
              }
            </select>
          </label>

          <div class="waiter-reservations-actions">
            <button type="button" class="btn btn-small btn-ghost" (click)="showAllDates()">כל התאריכים</button>
            <button type="button" class="btn btn-small btn-ghost" (click)="resetFilters()">איפוס סינון</button>
          </div>
        </div>

        @if (filteredReservations(reservations); as visibleReservations) {
          <div class="waiter-list-header">
            <p>מציג {{ visibleReservations.length }} מתוך {{ reservations.length }} הזמנות מקום</p>
          </div>

          @if (!reservations.length) {
            <div class="empty-state">
              <h2>לא נמצאו הזמנות מקום</h2>
            </div>
          } @else if (visibleReservations.length) {
            <div class="resource-grid waiter-reservations-grid">
              @for (reservation of visibleReservations; track reservation.id) {
                <app-reservation-card [reservation]="reservation" />
              }
            </div>
          } @else {
            <div class="empty-state">
              <h2>לא נמצאו הזמנות מקום</h2>
              <button type="button" class="btn btn-ghost" (click)="resetFilters()">איפוס סינון</button>
            </div>
          }
        }
      } @else {
        <div class="empty-state">
          <h2>טוען הזמנות מקום...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .waiter-reservations-page {
      display: grid;
      gap: 1rem;
    }

    .waiter-reservations-toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(140px, 170px) minmax(140px, 170px) minmax(140px, 170px) auto;
      align-items: end;
      gap: 1rem;
    }

    .waiter-reservations-toolbar input,
    .waiter-reservations-toolbar select {
      min-height: 48px;
    }

    .waiter-reservations-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .waiter-reservations-actions .btn {
      min-height: 42px;
      white-space: nowrap;
    }

    .waiter-list-header {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 850;
    }

    .waiter-list-header p {
      margin: 0;
    }

    .waiter-reservations-grid {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    :host ::ng-deep .waiter-reservations-grid .reservation-card {
      min-height: 100%;
    }

    @media (max-width: 1080px) {
      .waiter-reservations-toolbar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .waiter-reservations-search,
      .waiter-reservations-actions {
        grid-column: 1 / -1;
      }

      .waiter-reservations-actions {
        justify-content: flex-start;
      }
    }

    @media (max-width: 680px) {
      .waiter-reservations-toolbar,
      .waiter-reservations-grid {
        grid-template-columns: 1fr;
      }

      .waiter-reservations-search,
      .waiter-reservations-actions {
        grid-column: auto;
      }

      .waiter-reservations-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .waiter-list-header {
        justify-content: flex-start;
      }
    }
  `]
})
export class WaiterReservationsPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly today = this.localDate();
  private readonly dateRange$ = new BehaviorSubject<WaiterReservationDateRange>({
    fromDate: this.today,
    toDate: this.today
  });

  readonly reservations$: Observable<Reservation[]> = this.dateRange$.pipe(
    switchMap(({ fromDate, toDate }) =>
      this.data.getReservations(fromDate || undefined, toDate || undefined)
    )
  );
  readonly statusFilters: { value: WaiterReservationStatusFilter; label: string }[] = [
    { value: 'all', label: 'הכל' },
    { value: ReservationStatus.Pending, label: 'ממתינות' },
    { value: ReservationStatus.Approved, label: 'מאושרות' },
    { value: ReservationStatus.Rejected, label: 'נדחו' },
    { value: ReservationStatus.Cancelled, label: 'בוטלו' },
    { value: ReservationStatus.Arrived, label: reservationStatusLabels[ReservationStatus.Arrived] },
    { value: ReservationStatus.NoShow, label: reservationStatusLabels[ReservationStatus.NoShow] }
  ];

  selectedFromDate = this.today;
  selectedToDate = this.today;
  selectedStatus: WaiterReservationStatusFilter = 'all';
  searchTerm = '';

  filteredReservations(reservations: Reservation[]): Reservation[] {
    const search = this.searchTerm.trim().toLowerCase();

    return reservations.filter((reservation) => {
      if (this.selectedStatus !== 'all' && reservation.status !== this.selectedStatus) {
        return false;
      }

      if (!search) {
        return true;
      }

      const firstName = reservation.customerFirstName ?? '';
      const lastName = reservation.customerLastName ?? '';
      const searchableText = [
        firstName,
        lastName,
        `${firstName} ${lastName}`,
        `${lastName} ${firstName}`,
        reservation.phoneNumber ?? ''
      ].join(' ').toLowerCase();

      return searchableText.includes(search);
    });
  }

  setFromDate(value: string): void {
    this.selectedFromDate = value;
    this.reloadReservations();
  }

  setToDate(value: string): void {
    this.selectedToDate = value;
    this.reloadReservations();
  }

  showAllDates(): void {
    this.selectedFromDate = '';
    this.selectedToDate = '';
    this.reloadReservations();
  }

  resetFilters(): void {
    const today = this.localDate();
    this.searchTerm = '';
    this.selectedStatus = 'all';
    this.selectedFromDate = today;
    this.selectedToDate = today;
    this.reloadReservations();
  }

  setStatusFilter(value: string): void {
    this.selectedStatus = value === 'all' ? 'all' : Number(value) as ReservationStatus;
  }

  statusFilterValue(): string {
    return this.filterValue(this.selectedStatus);
  }

  filterValue(value: WaiterReservationStatusFilter): string {
    return value === 'all' ? 'all' : String(value);
  }

  private reloadReservations(): void {
    this.dateRange$.next({
      fromDate: this.selectedFromDate,
      toDate: this.selectedToDate
    });
  }

  private localDate(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }
}
