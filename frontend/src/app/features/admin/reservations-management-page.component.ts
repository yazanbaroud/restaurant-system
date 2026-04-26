import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, of, switchMap, tap } from 'rxjs';

import { Reservation, ReservationStatus } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ReservationCardComponent, ReservationStatusChange } from '../../shared/components/reservation-card.component';
import { reservationStatusLabels } from '../../shared/ui-labels';

type ReservationFilter = 'all' | ReservationStatus;

interface ReservationDateRange {
  fromDate: string;
  toDate: string;
}

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

      @if (reservations$ | async; as reservations) {
        @if (filteredReservations(reservations); as visibleReservations) {
          <div class="panel reservations-toolbar">
            <label class="toolbar-search">
              חיפוש
              <input
                #reservationSearch
                type="search"
                [value]="searchTerm"
                (input)="searchTerm = reservationSearch.value"
                placeholder="חיפוש לפי שם או טלפון"
                autocomplete="off"
              />
            </label>

            <label class="toolbar-filter">
              מתאריך
              <input
                #reservationFromDate
                type="date"
                [value]="selectedFromDate"
                (change)="setFromDateFilter(reservationFromDate.value)"
              />
            </label>

            <label class="toolbar-filter">
              עד תאריך
              <input
                #reservationToDate
                type="date"
                [value]="selectedToDate"
                (change)="setToDateFilter(reservationToDate.value)"
              />
            </label>

            <label class="toolbar-filter">
              סטטוס
              <select #statusFilterSelect [value]="statusFilterValue()" (change)="setStatusFilter(statusFilterSelect.value)">
                @for (filter of filters; track filter.value) {
                  <option [value]="filterOptionValue(filter.value)">{{ filter.label }}</option>
                }
              </select>
            </label>

            <div class="reservations-toolbar-summary">
              <button type="button" class="reservations-clear-date" [disabled]="!selectedFromDate && !selectedToDate" (click)="clearDateFilter()">
                כל התאריכים
              </button>
              <button type="button" class="btn btn-small btn-ghost reservations-reset-filters" (click)="resetFilters()">
                איפוס סינון
              </button>
              <span>מציג {{ visibleReservations.length }} מתוך {{ reservations.length }} הזמנות מקום</span>
            </div>
          </div>

          @if (errorMessage) {
            <p class="validation-note">{{ errorMessage }}</p>
          }

          @if (isLoading) {
            <div class="empty-state">
              <h2>טוען הזמנות מקום...</h2>
            </div>
          } @else if (!reservations.length) {
            <div class="empty-state">
              <h2>לא נמצאו הזמנות מקום</h2>
            </div>
          } @else if (visibleReservations.length) {
            <div class="resource-grid reservations-grid">
              @for (reservation of visibleReservations; track reservation.id) {
                <app-reservation-card
                  [reservation]="reservation"
                  [showActions]="!isUpdating(reservation.id)"
                  (statusChange)="setStatus(reservation.id, $event)"
                />
              }
            </div>
          } @else {
            <div class="empty-state">
              <h2>לא נמצאו הזמנות מקום מתאימות</h2>
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
    .reservations-toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(140px, 180px) minmax(140px, 180px) minmax(150px, 190px) auto;
      align-items: end;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .reservations-toolbar-summary {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.85rem;
      color: var(--muted);
      font-weight: 850;
      white-space: nowrap;
    }

    .reservations-clear-date {
      border: 0;
      background: transparent;
      color: var(--burgundy);
      cursor: pointer;
      font: inherit;
      font-weight: 900;
      padding: 0;
    }

    .reservations-clear-date:disabled {
      color: var(--muted);
      cursor: default;
      opacity: 0.45;
    }

    .reservations-reset-filters {
      min-height: 36px;
      padding-inline: 12px;
    }

    .reservations-grid {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      align-items: stretch;
    }

    .reservations-grid app-reservation-card {
      display: block;
      min-width: 0;
    }

    @media (max-width: 920px) {
      .reservations-toolbar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .toolbar-search,
      .reservations-toolbar-summary {
        grid-column: 1 / -1;
      }

      .reservations-toolbar-summary {
        justify-content: flex-start;
        flex-wrap: wrap;
      }
    }

    @media (max-width: 620px) {
      .reservations-toolbar {
        grid-template-columns: 1fr;
      }

      .toolbar-search,
      .reservations-toolbar-summary {
        grid-column: auto;
      }

      .reservations-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ReservationsManagementPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly initialDate = this.todayLocalDate();
  private readonly dateRange$ = new BehaviorSubject<ReservationDateRange>({
    fromDate: this.initialDate,
    toDate: this.initialDate
  });

  readonly reservations$: Observable<Reservation[]>;
  readonly filters: { value: ReservationFilter; label: string }[] = [
    { value: 'all', label: 'הכל' },
    { value: ReservationStatus.Pending, label: 'ממתינות' },
    { value: ReservationStatus.Approved, label: 'מאושרות' },
    { value: ReservationStatus.Rejected, label: 'נדחו' },
    { value: ReservationStatus.Cancelled, label: 'בוטלו' },
    { value: ReservationStatus.Arrived, label: reservationStatusLabels[ReservationStatus.Arrived] },
    { value: ReservationStatus.NoShow, label: reservationStatusLabels[ReservationStatus.NoShow] }
  ];

  selectedFilter: ReservationFilter = 'all';
  selectedFromDate = this.initialDate;
  selectedToDate = this.initialDate;
  searchTerm = '';
  isLoading = true;
  updatingReservationId: number | null = null;
  errorMessage = '';

  constructor() {
    this.reservations$ = this.dateRange$.pipe(
      tap(() => {
        this.isLoading = true;
        this.errorMessage = '';
      }),
      switchMap(({ fromDate, toDate }) =>
        this.data.getReservations(fromDate, toDate).pipe(
          tap(() => {
            this.isLoading = false;
          }),
          catchError(() => {
            this.errorMessage = 'לא הצלחנו לטעון את הזמנות המקום. נסו שוב בעוד רגע.';
            this.isLoading = false;
            return of([]);
          })
        )
      )
    );
  }

  filteredReservations(reservations: Reservation[]): Reservation[] {
    const search = this.normalizeSearch(this.searchTerm);

    return reservations.filter((reservation) => {
      if (this.selectedFilter !== 'all' && reservation.status !== this.selectedFilter) {
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

  setFromDateFilter(date: string): void {
    this.selectedFromDate = date;
    this.reloadReservationsForDateRange();
  }

  setToDateFilter(date: string): void {
    this.selectedToDate = date;
    this.reloadReservationsForDateRange();
  }

  clearDateFilter(): void {
    this.selectedFromDate = '';
    this.selectedToDate = '';
    this.reloadReservationsForDateRange();
  }

  resetFilters(): void {
    const today = this.todayLocalDate();
    this.searchTerm = '';
    this.selectedFilter = 'all';
    this.selectedFromDate = today;
    this.selectedToDate = today;
    this.reloadReservationsForDateRange();
  }

  setStatusFilter(value: string): void {
    this.selectedFilter = value === 'all' ? 'all' : Number(value) as ReservationStatus;
  }

  statusFilterValue(): string {
    return this.filterOptionValue(this.selectedFilter);
  }

  filterOptionValue(filter: ReservationFilter): string {
    return filter === 'all' ? 'all' : String(filter);
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

  private todayLocalDate(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  private reloadReservationsForDateRange(): void {
    this.dateRange$.next({
      fromDate: this.selectedFromDate,
      toDate: this.selectedToDate
    });
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }
}
