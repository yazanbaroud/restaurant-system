import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { Reservation } from '../../core/models';
import { CustomerReservationsService } from '../../core/services/customer-reservations.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { reservationStatusLabels, reservationStatusTones } from '../../shared/ui-labels';

@Component({
  selector: 'app-customer-reservations-page',
  standalone: true,
  imports: [PageHeaderComponent, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-surface customer-reservations-page">
      <app-page-header
        eyebrow="הזמנות מקום"
        title="הזמנות מקום שלי"
        subtitle="כל הבקשות שנשלחו מהחשבון שלך, כולל סטטוס עדכני והערות מהמסעדה."
      >
        <a class="btn btn-gold" routerLink="/reservation">הזמנת מקום חדשה</a>
      </app-page-header>

      @if (isLoading) {
        <div class="empty-state">
          <h2>טוען הזמנות מקום...</h2>
        </div>
      } @else if (errorMessage) {
        <div class="empty-state">
          <h2>לא הצלחנו לטעון את הזמנות המקום</h2>
          <p class="muted">{{ errorMessage }}</p>
          <button type="button" class="btn btn-ghost" (click)="loadReservations()">נסו שוב</button>
        </div>
      } @else if (reservations.length) {
        <div class="customer-reservations-count">
          מציג {{ reservations.length }} הזמנות מקום
        </div>

        <div class="customer-reservations-grid">
          @for (reservation of reservations; track reservation.id) {
            <article class="customer-reservation-card">
              <div class="customer-reservation-card__header">
                <div>
                  <p class="eyebrow">הזמנת מקום #{{ reservation.id }}</p>
                  <h2>{{ reservationDateLabel(reservation) }}</h2>
                  <span class="muted">{{ timeLabel(reservation.reservationTime) }}</span>
                </div>
                <app-status-badge
                  [label]="reservationStatusLabels[reservation.status]"
                  [tone]="reservationStatusTones[reservation.status]"
                />
              </div>

              <dl class="customer-reservation-meta">
                <div>
                  <dt>סועדים</dt>
                  <dd>{{ reservation.guestCount }}</dd>
                </div>
                <div>
                  <dt>טלפון</dt>
                  <dd>{{ reservation.phoneNumber }}</dd>
                </div>
              </dl>

              @if (reservation.restaurantNotes) {
                <p class="note">הערת מסעדה: {{ reservation.restaurantNotes }}</p>
              }

              <div class="customer-reservation-card__footer">
                <a class="btn btn-small btn-dark" [routerLink]="['/reservations', reservation.id]">צפייה בפרטים</a>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state">
          <h2>אין לך הזמנות מקום עדיין</h2>
          <p class="muted">אפשר לשלוח בקשה להזמנת מקום, ואנחנו נעדכן אותך אחרי אישור הצוות.</p>
          <a class="btn btn-gold" routerLink="/reservation">הזמנת מקום</a>
        </div>
      }
    </section>
  `,
  styles: [`
    .customer-reservations-page {
      display: grid;
      gap: 1rem;
    }

    .customer-reservations-count {
      display: flex;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 850;
    }

    .customer-reservations-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .customer-reservation-card {
      display: grid;
      gap: 0.9rem;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.74);
      box-shadow: var(--shadow-soft);
    }

    .customer-reservation-card__header,
    .customer-reservation-card__footer {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .customer-reservation-card__header h2 {
      margin: 0.1rem 0 0.2rem;
      font-size: 1.1rem;
      line-height: 1.35;
    }

    .customer-reservation-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
      margin: 0;
    }

    .customer-reservation-meta div {
      display: grid;
      gap: 0.2rem;
      padding: 10px;
      border-radius: var(--radius);
      background: rgba(31, 21, 17, 0.04);
    }

    .customer-reservation-meta dt {
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 800;
    }

    .customer-reservation-meta dd {
      margin: 0;
      color: var(--brown-950);
      font-weight: 900;
    }

    .customer-reservation-card__footer {
      justify-content: flex-end;
    }

    @media (max-width: 680px) {
      .customer-reservations-count {
        justify-content: flex-start;
      }

      .customer-reservations-grid,
      .customer-reservation-meta {
        grid-template-columns: 1fr;
      }

      .customer-reservation-card__header,
      .customer-reservation-card__footer {
        align-items: stretch;
        flex-direction: column;
      }

      .customer-reservation-card__footer .btn {
        width: 100%;
      }
    }
  `]
})
export class CustomerReservationsPageComponent {
  private readonly customerReservations = inject(CustomerReservationsService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly reservationStatusLabels = reservationStatusLabels;
  readonly reservationStatusTones = reservationStatusTones;

  reservations: Reservation[] = [];
  isLoading = true;
  errorMessage = '';

  constructor() {
    this.loadReservations();
  }

  loadReservations(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.customerReservations.getReservations().pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (reservations) => {
        this.reservations = reservations;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'בדקו את החיבור ונסו שוב בעוד רגע.';
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
