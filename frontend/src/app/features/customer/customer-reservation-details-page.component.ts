import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Reservation, ReservationStatus } from '../../core/models';
import { CustomerReservationsService } from '../../core/services/customer-reservations.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { reservationStatusLabels, reservationStatusTones } from '../../shared/ui-labels';

@Component({
  selector: 'app-customer-reservation-details-page',
  standalone: true,
  imports: [PageHeaderComponent, RouterLink, StatusBadgeComponent],
  template: `
    @if (isLoading) {
      <section class="page-surface narrow-page empty-state">
        <h1>טוען הזמנת מקום...</h1>
      </section>
    } @else if (errorMessage && !reservation) {
      <section class="page-surface narrow-page empty-state">
        <h1>לא מצאנו את הזמנת המקום המבוקשת</h1>
        <p class="muted">{{ errorMessage }}</p>
        <a class="btn btn-dark" routerLink="/reservations">חזרה להזמנות מקום</a>
      </section>
    } @else if (reservation) {
      <section class="page-surface customer-reservation-details-page">
        <app-page-header
          eyebrow="הזמנת מקום"
          title="הזמנת מקום #{{ reservation.id }}"
          subtitle="פרטי הבקשה והסטטוס העדכני שלה."
        >
          <a class="btn btn-ghost" routerLink="/reservations">חזרה להזמנות מקום</a>
        </app-page-header>

        @if (successMessage) {
          <div class="customer-reservation-message customer-reservation-message--success" role="status">
            {{ successMessage }}
          </div>
        }

        @if (errorMessage) {
          <div class="customer-reservation-message customer-reservation-message--error" role="alert">
            {{ errorMessage }}
          </div>
        }

        <section class="panel customer-reservation-hero">
          <div>
            <p class="eyebrow">{{ reservationDateLabel(reservation) }} · {{ timeLabel(reservation.reservationTime) }}</p>
            <h2>{{ reservation.customerFirstName }} {{ reservation.customerLastName }}</h2>
            <div class="badge-row">
              <app-status-badge
                [label]="reservationStatusLabels[reservation.status]"
                [tone]="reservationStatusTones[reservation.status]"
              />
            </div>
          </div>
          <strong>{{ reservation.guestCount }} סועדים</strong>
        </section>

        <div class="customer-reservation-layout">
          <section class="panel customer-reservation-section">
            <h2>פרטי הזמנה</h2>
            <dl class="customer-reservation-meta">
              <div>
                <dt>שם</dt>
                <dd>{{ reservation.customerFirstName }} {{ reservation.customerLastName }}</dd>
              </div>
              <div>
                <dt>טלפון</dt>
                <dd>{{ reservation.phoneNumber }}</dd>
              </div>
              <div>
                <dt>תאריך</dt>
                <dd>{{ reservationDateLabel(reservation) }}</dd>
              </div>
              <div>
                <dt>שעה</dt>
                <dd>{{ timeLabel(reservation.reservationTime) }}</dd>
              </div>
              <div>
                <dt>סועדים</dt>
                <dd>{{ reservation.guestCount }}</dd>
              </div>
              <div>
                <dt>סטטוס</dt>
                <dd>{{ reservationStatusLabels[reservation.status] }}</dd>
              </div>
            </dl>
          </section>

          <aside class="panel customer-reservation-section">
            <h2>הערות</h2>
            @if (reservation.notes) {
              <p class="note">בקשה שלך: {{ reservation.notes }}</p>
            } @else {
              <p class="muted">לא נוספו בקשות מיוחדות.</p>
            }

            @if (reservation.restaurantNotes) {
              <p class="note">הערת מסעדה: {{ reservation.restaurantNotes }}</p>
            }

            <div class="customer-reservation-actions">
              @if (canCancel(reservation)) {
                <button type="button" class="btn btn-danger" [disabled]="isCancelling" (click)="cancelReservation()">
                  {{ isCancelling ? 'מבטלים...' : 'ביטול הזמנת מקום' }}
                </button>
              } @else {
                <p class="muted">לא ניתן לבטל הזמנת מקום במצב הנוכחי דרך האזור האישי.</p>
              }
            </div>
          </aside>
        </div>
      </section>
    }
  `,
  styles: [`
    .customer-reservation-details-page {
      display: grid;
      gap: 1rem;
    }

    .customer-reservation-message {
      padding: 12px 14px;
      border-radius: var(--radius);
      font-weight: 850;
    }

    .customer-reservation-message--success {
      border: 1px solid rgba(102, 112, 68, 0.28);
      background: rgba(102, 112, 68, 0.12);
      color: var(--olive-dark);
    }

    .customer-reservation-message--error {
      border: 1px solid rgba(124, 38, 48, 0.22);
      background: rgba(124, 38, 48, 0.08);
      color: var(--burgundy);
    }

    .customer-reservation-hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .customer-reservation-hero h2 {
      margin: 0;
    }

    .customer-reservation-hero > strong {
      color: var(--burgundy);
      font-size: 1.7rem;
      white-space: nowrap;
    }

    .customer-reservation-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 18px;
      align-items: start;
    }

    .customer-reservation-section {
      display: grid;
      gap: 1rem;
    }

    .customer-reservation-meta {
      display: grid;
      gap: 0.75rem;
      margin: 0;
    }

    .customer-reservation-meta div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--line);
    }

    .customer-reservation-meta dt {
      color: var(--muted);
      font-weight: 800;
    }

    .customer-reservation-meta dd {
      margin: 0;
      color: var(--brown-950);
      font-weight: 900;
      text-align: end;
    }

    .customer-reservation-actions {
      display: grid;
      gap: 0.7rem;
      margin-top: 0.5rem;
    }

    @media (max-width: 900px) {
      .customer-reservation-layout {
        grid-template-columns: 1fr;
      }

      .customer-reservation-hero {
        align-items: flex-start;
        flex-direction: column;
      }
    }

    @media (max-width: 620px) {
      .customer-reservation-meta div {
        align-items: flex-start;
        flex-direction: column;
      }

      .customer-reservation-meta dd {
        text-align: start;
      }
    }
  `]
})
export class CustomerReservationDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly customerReservations = inject(CustomerReservationsService);
  private readonly feedback = inject(FeedbackService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly ReservationStatus = ReservationStatus;
  readonly reservationStatusLabels = reservationStatusLabels;
  readonly reservationStatusTones = reservationStatusTones;

  reservation: Reservation | null = null;
  isLoading = true;
  isCancelling = false;
  errorMessage = '';
  successMessage = '';

  constructor() {
    this.loadReservation();
  }

  loadReservation(): void {
    if (!Number.isFinite(this.id) || this.id <= 0) {
      this.isLoading = false;
      this.errorMessage = 'הקישור להזמנת המקום אינו תקין.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.customerReservations.getReservation(this.id).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (reservation) => {
        this.reservation = reservation;
        this.cdr.detectChanges();
      },
      error: () => {
        this.reservation = null;
        this.errorMessage = 'ייתכן שההזמנה לא קיימת או שאינה שייכת לחשבון הזה.';
        this.cdr.detectChanges();
      }
    });
  }

  canCancel(reservation: Reservation): boolean {
    return reservation.status === ReservationStatus.Pending || reservation.status === ReservationStatus.Approved;
  }

  cancelReservation(): void {
    if (!this.reservation || this.isCancelling || !this.canCancel(this.reservation)) {
      return;
    }

    const confirmed = window.confirm('האם לבטל את הזמנת המקום?');
    if (!confirmed) {
      return;
    }

    this.isCancelling = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.customerReservations.cancelReservation(this.reservation.id).pipe(
      finalize(() => {
        this.isCancelling = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (reservation) => {
        this.reservation = reservation;
        this.successMessage = 'הזמנת המקום בוטלה בהצלחה.';
        this.feedback.success(this.successMessage);
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לבטל את הזמנת המקום. נסו שוב בעוד רגע.');
        this.feedback.error(error, this.errorMessage);
        this.cdr.detectChanges();
      }
    });
  }

  reservationDateLabel(reservation: Reservation): string {
    if (!reservation.reservationDate) {
      return 'תאריך לא זמין';
    }

    return new Intl.DateTimeFormat('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(`${reservation.reservationDate}T12:00:00`));
  }

  timeLabel(time: string): string {
    return time ? time.slice(0, 5) : 'שעה לא זמינה';
  }
}
