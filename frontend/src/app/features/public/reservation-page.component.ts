import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

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
          subtitle="טופס קצר להזמנת מקום במסעדת הכבש. ההזמנה נשמרת כבקשה ממתינה במערכת הניהול."
        />
        @if (successMessage) {
          <div class="success-panel">
            <strong>{{ successMessage }}</strong>
            <p>צוות המסעדה יאשר את ההזמנה ויחזור אליכם טלפונית במידת הצורך.</p>
          </div>
        }
        <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            שם פרטי
            <input formControlName="firstName" autocomplete="given-name" />
          </label>
          <label>
            שם משפחה
            <input formControlName="lastName" autocomplete="family-name" />
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
            <input type="number" min="1" max="30" formControlName="guestsCount" />
          </label>
          <label class="full">
            בקשות מיוחדות
            <textarea formControlName="customerNotes" rows="4"></textarea>
          </label>
          <button class="btn btn-gold full" type="submit" [disabled]="form.invalid">שליחת בקשה</button>
        </form>
      </div>
      <aside class="reservation-aside">
        <img src="https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=900&q=80" alt="שולחן אירוח במסעדה" />
        <div>
          <p class="eyebrow">אירוח דרוזי</p>
          <h2>שולחן עם סלטים, גריל ומקום לשיחה</h2>
          <p>הטופס מותאם לזרימה העתידית מול backend אמיתי, אבל כרגע עובד על mock data בלבד.</p>
        </div>
      </aside>
    </section>
  `
})
export class ReservationPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(RestaurantDataService);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, Validators.minLength(9)]],
    reservationDate: ['2026-04-24', Validators.required],
    reservationTime: ['19:30', Validators.required],
    guestsCount: [4, [Validators.required, Validators.min(1)]],
    customerNotes: ['']
  });

  successMessage = '';

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const reservation = this.data.createReservation(this.form.getRawValue());
    this.successMessage = `הבקשה נשמרה עבור ${reservation.firstName} ${reservation.lastName}`;
    this.form.reset({
      firstName: '',
      lastName: '',
      phoneNumber: '',
      reservationDate: '2026-04-24',
      reservationTime: '19:30',
      guestsCount: 4,
      customerNotes: ''
    });
  }
}
