import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-reservation-page',
  standalone: true,
  imports: [PageHeaderComponent, ReactiveFormsModule],
  template: `
    <section class="container page-surface split-layout">
      <div>
        <app-page-header
          eyebrow="הזמנת מקום"
          title="נשמור לכם שולחן חם"
          subtitle="טופס קצר להזמנת מקום במסעדת הכבש. הבקשה עוברת לצוות המסעדה לאישור וחזרה טלפונית במידת הצורך."
        />
        @if (successMessage) {
          <div class="success-panel">
            <strong>{{ successMessage }}</strong>
            <p>צוות המסעדה יאשר את ההזמנה ויחזור אליכם טלפונית במידת הצורך.</p>
          </div>
        }
        @if (errorMessage) {
          <p class="validation-note">{{ errorMessage }}</p>
        }
        <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            שם פרטי
            <input formControlName="customerFirstName" autocomplete="given-name" />
          </label>
          <label>
            שם משפחה
            <input formControlName="customerLastName" autocomplete="family-name" />
          </label>
          <label>
            טלפון
            <input formControlName="phoneNumber" autocomplete="tel" />
          </label>
          <label>
            תאריך
            <input type="date" formControlName="reservationDate" />
          </label>
          <label>
            שעה
            <input type="time" formControlName="reservationTime" />
          </label>
          <label>
            מספר סועדים
            <input type="number" min="1" max="30" formControlName="guestCount" />
          </label>
          <label class="full">
            בקשות מיוחדות
            <textarea formControlName="notes" rows="4"></textarea>
          </label>
          <button class="btn btn-gold full" type="submit" [disabled]="form.invalid || isSubmitting">
            {{ isSubmitting ? 'שולחים בקשה...' : 'שליחת בקשה' }}
          </button>
        </form>
      </div>
      <aside class="reservation-aside">
        <img src="https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=900&q=80" alt="שולחן אירוח במסעדה" />
        <div>
          <p class="eyebrow">אירוח דרוזי</p>
          <h2>שולחן עם סלטים, גריל ומקום לשיחה</h2>
          <p>אנחנו מכינים לכל שולחן חוויה נדיבה של סלטים טריים, בשרים על האש, תבשילים ביתיים ואירוח חם מהכרמל.</p>
        </div>
      </aside>
    </section>
  `
})
export class ReservationPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(RestaurantDataService);

  readonly form = this.fb.nonNullable.group({
    customerFirstName: ['', Validators.required],
    customerLastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, Validators.minLength(9)]],
    reservationDate: ['2026-04-24', Validators.required],
    reservationTime: ['19:30', Validators.required],
    guestCount: [4, [Validators.required, Validators.min(1)]],
    notes: ['']
  });

  successMessage = '';
  errorMessage = '';
  isSubmitting = false;

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.data.createReservation(this.form.getRawValue()).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: (reservation) => {
        this.successMessage = `הבקשה נשמרה עבור ${reservation.customerFirstName} ${reservation.customerLastName}`;
        this.form.reset({
          customerFirstName: '',
          customerLastName: '',
          phoneNumber: '',
          reservationDate: '2026-04-24',
          reservationTime: '19:30',
          guestCount: 4,
          notes: ''
        });
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לשמור את ההזמנה. נסו שוב בעוד רגע.';
      }
    });
  }
}
