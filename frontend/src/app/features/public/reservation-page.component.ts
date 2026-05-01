import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { BusinessHour } from '../../core/models';
import { BusinessHoursService } from '../../core/services/business-hours.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { israeliPhoneValidator } from '../../shared/form-validation';

const DEFAULT_RESERVATION_TIME = '19:30';
const DEFAULT_GUEST_COUNT = 2;
const MAX_GUEST_COUNT = 30;

@Component({
  selector: 'app-reservation-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="reservation-page" dir="rtl">
      <div class="reservation-hero">
        <p class="eyebrow">בקשת הזמנה</p>
        <h1>הזמנת מקום</h1>
        <p>
          מלאו כמה פרטים ונחזור אליכם לאישור סופי. הבקשה אינה אישור אוטומטי עד שצוות המסעדה מאשר אותה.
        </p>
      </div>

      <div class="reservation-layout">
        <form class="reservation-card reservation-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="reservation-card__header">
            <div>
              <h2>פרטי ההזמנה</h2>
              <p>שדות חובה מסומנים בכוכבית.</p>
            </div>
            @if (successMessage) {
              <span class="reservation-badge">ממתין לאישור</span>
            }
          </div>

          @if (successMessage) {
            <div class="reservation-success" role="status">
              <strong>{{ successMessage }}</strong>
              <span>הפרטים נשלחו לצוות המסעדה.</span>
            </div>
          }

          @if (errorMessage) {
            <div class="reservation-error" role="alert">{{ errorMessage }}</div>
          }

          <div class="reservation-form-grid">
            <label>
              <span>שם פרטי <b>*</b></span>
              <input formControlName="customerFirstName" autocomplete="given-name" placeholder="לדוגמה: נועה" />
              @if (fieldError('customerFirstName')) {
                <small class="field-error">{{ fieldError('customerFirstName') }}</small>
              }
            </label>

            <label>
              <span>שם משפחה <b>*</b></span>
              <input formControlName="customerLastName" autocomplete="family-name" placeholder="לדוגמה: כהן" />
              @if (fieldError('customerLastName')) {
                <small class="field-error">{{ fieldError('customerLastName') }}</small>
              }
            </label>

            <label>
              <span>טלפון <b>*</b></span>
              <input formControlName="phoneNumber" autocomplete="tel" inputmode="tel" placeholder="050-123-4567" />
              @if (fieldError('phoneNumber')) {
                <small class="field-error">{{ fieldError('phoneNumber') }}</small>
              }
            </label>

            <label>
              <span>תאריך <b>*</b></span>
              <input class="date-time-input" type="date" formControlName="reservationDate" [min]="minDate" />
              @if (fieldError('reservationDate')) {
                <small class="field-error">{{ fieldError('reservationDate') }}</small>
              }
            </label>

            <label>
              <span>שעה <b>*</b></span>
              <input
                class="date-time-input"
                type="time"
                formControlName="reservationTime"
                [min]="selectedOpenTime()"
                [max]="selectedCloseTime()"
                step="900"
              />
              @if (fieldError('reservationTime')) {
                <small class="field-error">{{ fieldError('reservationTime') }}</small>
              }
            </label>

            <div class="reservation-guests-field">
              <span>מספר סועדים <b>*</b></span>
              <div class="reservation-stepper" aria-label="מספר סועדים">
                <button type="button" aria-label="הפחתת מספר סועדים" (click)="changeGuests(-1)">−</button>
                <input type="number" min="1" [max]="maxGuests" formControlName="guestCount" />
                <button type="button" aria-label="הגדלת מספר סועדים" (click)="changeGuests(1)">+</button>
              </div>
              @if (fieldError('guestCount')) {
                <small class="field-error">{{ fieldError('guestCount') }}</small>
              }
            </div>

            <label class="full">
              <span>בקשות מיוחדות</span>
              <textarea
                formControlName="notes"
                rows="4"
                maxlength="1000"
                placeholder="לדוגמה: כיסא תינוק, שולחן שקט, רגישויות או בקשה אחרת"
              ></textarea>
              @if (fieldError('notes')) {
                <small class="field-error">{{ fieldError('notes') }}</small>
              }
            </label>
          </div>

          @if (businessHoursNotice(); as notice) {
            <div class="business-hours-notice" [class.business-hours-notice--blocked]="businessHoursValidationMessage()">
              {{ notice }}
            </div>
          }

          <button class="btn btn-gold full reservation-submit" type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? 'שולחים בקשה...' : 'שליחת בקשה לאישור' }}
          </button>
        </form>

        <aside class="reservation-summary-card">
          <div class="reservation-summary-card__image">
            <img src="https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=900&q=80" alt="שולחן אירוח במסעדה" />
          </div>

          <div class="reservation-summary">
            <p class="eyebrow">סיכום לפני שליחה</p>
            <h2>{{ summaryDate() }}</h2>
            <dl>
              <div>
                <dt>שעה</dt>
                <dd>{{ form.controls.reservationTime.value || 'לא נבחרה' }}</dd>
              </div>
              <div>
                <dt>סועדים</dt>
                <dd>{{ form.controls.guestCount.value || 0 }}</dd>
              </div>
              <div>
                <dt>שם</dt>
                <dd>{{ summaryName() }}</dd>
              </div>
              <div>
                <dt>טלפון</dt>
                <dd>{{ form.controls.phoneNumber.value || 'לא הוזן' }}</dd>
              </div>
            </dl>

            <div class="reservation-note">
              <strong>חשוב לדעת</strong>
              <span>ניצור איתך קשר לאישור סופי. אם יש שינוי במספר הסועדים, כדאי לציין זאת בבקשות.</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: [`
    .reservation-page {
      display: grid;
      gap: 22px;
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 16px 54px;
    }

    .reservation-hero {
      display: grid;
      gap: 8px;
      max-width: 760px;
    }

    .reservation-hero h1,
    .reservation-hero p {
      margin: 0;
    }

    .reservation-hero h1 {
      color: var(--brown-950);
      font-size: clamp(2.35rem, 5vw, 4.4rem);
      line-height: 0.98;
    }

    .reservation-hero p {
      color: var(--muted);
      font-size: 1.08rem;
      line-height: 1.75;
    }

    .reservation-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 390px);
      gap: 18px;
      align-items: start;
    }

    .reservation-card,
    .reservation-summary-card {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.86);
      box-shadow: 0 12px 30px rgba(31, 21, 17, 0.08);
    }

    .reservation-form {
      display: grid;
      gap: 16px;
      padding: 20px;
    }

    .reservation-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }

    .reservation-card__header h2,
    .reservation-card__header p {
      margin: 0;
    }

    .reservation-card__header p {
      margin-top: 4px;
      color: var(--muted);
      font-weight: 800;
    }

    .reservation-badge {
      flex: 0 0 auto;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(199, 154, 59, 0.18);
      color: var(--gold-dark);
      font-weight: 950;
    }

    .reservation-success,
    .reservation-error {
      display: grid;
      gap: 4px;
      padding: 12px;
      border-radius: var(--radius);
      font-weight: 850;
    }

    .reservation-success {
      border: 1px solid rgba(102, 112, 68, 0.28);
      background: rgba(102, 112, 68, 0.12);
      color: var(--olive-dark);
    }

    .reservation-error {
      border: 1px solid rgba(124, 38, 48, 0.22);
      background: rgba(124, 38, 48, 0.08);
      color: var(--burgundy);
    }

    .business-hours-notice {
      padding: 11px 12px;
      border: 1px solid rgba(102, 112, 68, 0.24);
      border-radius: var(--radius);
      background: rgba(102, 112, 68, 0.1);
      color: var(--olive-dark);
      font-weight: 850;
    }

    .business-hours-notice--blocked {
      border-color: rgba(124, 38, 48, 0.24);
      background: rgba(124, 38, 48, 0.08);
      color: var(--burgundy);
    }

    .reservation-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .reservation-form-grid label,
    .reservation-guests-field {
      display: grid;
      gap: 7px;
      color: var(--brown-950);
      font-weight: 900;
    }

    .reservation-form-grid label > span b,
    .reservation-guests-field > span b {
      color: var(--burgundy);
    }

    .reservation-form-grid input,
    .reservation-form-grid textarea,
    .reservation-stepper {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.82);
      color: var(--brown-950);
      font: inherit;
    }

    .reservation-form-grid input,
    .reservation-form-grid textarea {
      width: 100%;
    }

    .reservation-form-grid input {
      min-height: 44px;
      padding: 0 12px;
    }

    .reservation-form-grid textarea {
      min-height: 108px;
      padding: 12px;
      resize: vertical;
    }

    .reservation-stepper {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr) 46px;
      overflow: hidden;
    }

    .reservation-stepper button {
      min-height: 44px;
      border: 0;
      background: rgba(31, 21, 17, 0.08);
      color: var(--brown-950);
      cursor: pointer;
      font-weight: 950;
      font-size: 1.1rem;
    }

    .reservation-stepper input {
      border: 0;
      border-radius: 0;
      text-align: center;
      font-weight: 950;
    }

    .reservation-submit {
      min-height: 50px;
    }

    .reservation-summary-card {
      position: sticky;
      top: calc(var(--topbar-height) + 16px);
      display: grid;
      background: var(--brown-950);
      color: var(--ivory);
    }

    .reservation-summary-card__image img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
    }

    .reservation-summary {
      display: grid;
      gap: 16px;
      padding: 18px;
    }

    .reservation-summary h2 {
      margin: 0;
      color: var(--ivory);
      font-size: 1.45rem;
    }

    .reservation-summary dl {
      display: grid;
      gap: 10px;
      margin: 0;
    }

    .reservation-summary dl div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 248, 237, 0.14);
    }

    .reservation-summary dt {
      color: rgba(255, 248, 237, 0.66);
      font-weight: 850;
    }

    .reservation-summary dd {
      margin: 0;
      color: var(--ivory);
      font-weight: 950;
      text-align: end;
    }

    .reservation-note {
      display: grid;
      gap: 4px;
      padding: 12px;
      border: 1px solid rgba(199, 154, 59, 0.22);
      border-radius: var(--radius);
      background: rgba(199, 154, 59, 0.12);
    }

    .reservation-note span {
      color: rgba(255, 248, 237, 0.72);
      font-weight: 800;
      line-height: 1.6;
    }

    @media (max-width: 980px) {
      .reservation-layout {
        grid-template-columns: 1fr;
      }

      .reservation-summary-card {
        position: static;
      }

      .reservation-summary-card__image {
        display: none;
      }
    }

    @media (max-width: 640px) {
      .reservation-page {
        padding-inline: 12px;
      }

      .reservation-form,
      .reservation-summary {
        padding: 14px;
      }

      .reservation-card__header {
        flex-direction: column;
      }

      .reservation-form-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ReservationPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(RestaurantDataService);
  private readonly businessHoursService = inject(BusinessHoursService);
  private readonly feedback = inject(FeedbackService);

  readonly minDate = this.todayDate();
  readonly maxGuests = MAX_GUEST_COUNT;

  readonly form = this.fb.nonNullable.group({
    customerFirstName: ['', Validators.required],
    customerLastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, israeliPhoneValidator()]],
    reservationDate: [this.minDate, [Validators.required, notPastDateValidator(() => this.todayDate())]],
    reservationTime: [DEFAULT_RESERVATION_TIME, Validators.required],
    guestCount: [DEFAULT_GUEST_COUNT, [Validators.required, Validators.min(1), Validators.max(MAX_GUEST_COUNT)]],
    notes: ['', Validators.maxLength(1000)]
  });

  businessHours: BusinessHour[] = [];
  businessHoursLoadFailed = false;
  isLoadingBusinessHours = true;
  successMessage = '';
  errorMessage = '';
  isSubmitting = false;
  submitted = false;

  constructor() {
    this.loadBusinessHours();
  }

  submit(): void {
    this.submitted = true;
    this.successMessage = '';
    this.errorMessage = '';

    if (this.isSubmitting) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'בדקו את השדות המסומנים ונסו שוב.';
      this.feedback.error(null, this.errorMessage);
      return;
    }

    const businessHoursMessage = this.businessHoursValidationMessage();
    if (businessHoursMessage) {
      this.errorMessage = businessHoursMessage;
      this.feedback.error(null, businessHoursMessage);
      return;
    }

    this.isSubmitting = true;
    this.data.createReservation(this.form.getRawValue()).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: () => {
        this.successMessage = 'הבקשה נשלחה בהצלחה, ניצור איתך קשר לאישור סופי.';
        this.feedback.success();
        this.submitted = false;
        this.form.reset(this.defaultFormValue());
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לשלוח את הבקשה. בדקו את הפרטים ונסו שוב.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }

  changeGuests(delta: number): void {
    const currentValue = Number(this.form.controls.guestCount.value) || 0;
    const nextValue = Math.min(MAX_GUEST_COUNT, Math.max(1, currentValue + delta));
    this.form.controls.guestCount.setValue(nextValue);
    this.form.controls.guestCount.markAsDirty();
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];
    if (!control || (!this.submitted && !control.touched && !control.dirty)) {
      return '';
    }

    if (controlName === 'customerFirstName' && control.hasError('required')) {
      return 'שם פרטי הוא שדה חובה';
    }
    if (controlName === 'customerLastName' && control.hasError('required')) {
      return 'שם משפחה הוא שדה חובה';
    }
    if (controlName === 'phoneNumber') {
      if (control.hasError('required')) {
        return 'מספר טלפון הוא שדה חובה';
      }
      if (control.hasError('phone')) {
        return 'מספר הטלפון אינו תקין';
      }
    }
    if (controlName === 'reservationDate') {
      if (control.hasError('required')) {
        return 'תאריך הזמנה הוא שדה חובה';
      }
      if (control.hasError('pastDate')) {
        return 'לא ניתן לבחור תאריך שכבר עבר';
      }
    }
    if (controlName === 'reservationTime') {
      if (control.hasError('required')) {
        return 'שעת הזמנה היא שדה חובה';
      }
    }
    if (controlName === 'guestCount') {
      if (control.hasError('required') || control.hasError('min')) {
        return 'מספר סועדים חייב להיות לפחות 1';
      }
      if (control.hasError('max')) {
        return `להזמנה מעל ${MAX_GUEST_COUNT} סועדים צרו קשר טלפוני`;
      }
    }
    if (controlName === 'notes' && control.hasError('maxlength')) {
      return 'בקשות מיוחדות יכולות להכיל עד 1000 תווים';
    }

    return '';
  }

  summaryName(): string {
    const firstName = this.form.controls.customerFirstName.value.trim();
    const lastName = this.form.controls.customerLastName.value.trim();
    return `${firstName} ${lastName}`.trim() || 'לא הוזן';
  }

  summaryDate(): string {
    const value = this.form.controls.reservationDate.value;
    if (!value) {
      return 'תאריך לא נבחר';
    }

    return new Intl.DateTimeFormat('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(`${value}T12:00:00`));
  }

  selectedOpenTime(): string | null {
    const businessHour = this.selectedBusinessHour();
    return businessHour?.isOpen ? businessHour.openTime : null;
  }

  selectedCloseTime(): string | null {
    const businessHour = this.selectedBusinessHour();
    return businessHour?.isOpen ? businessHour.closeTime : null;
  }

  businessHoursNotice(): string {
    if (this.isLoadingBusinessHours) {
      return 'בודקים את שעות הפעילות...';
    }
    if (this.businessHoursLoadFailed) {
      return 'לא הצלחנו לטעון את שעות הפעילות. ננסה לאמת את הבקשה בשליחה.';
    }

    const businessHour = this.selectedBusinessHour();
    if (!businessHour) {
      return '';
    }
    if (!businessHour.isOpen) {
      return 'המסעדה סגורה ביום שנבחר.';
    }
    if (businessHour.openTime && businessHour.closeTime) {
      return `המסעדה פתוחה ביום זה בין ${businessHour.openTime} ל־${businessHour.closeTime}`;
    }

    return '';
  }

  businessHoursValidationMessage(): string {
    if (this.isLoadingBusinessHours || this.businessHoursLoadFailed || !this.businessHours.length) {
      return '';
    }

    const businessHour = this.selectedBusinessHour();
    if (!businessHour) {
      return '';
    }
    if (!businessHour.isOpen) {
      return 'המסעדה סגורה ביום שנבחר.';
    }

    const reservationTime = this.form.controls.reservationTime.value;
    if (!businessHour.openTime || !businessHour.closeTime || reservationTime < businessHour.openTime || reservationTime > businessHour.closeTime) {
      return 'המסעדה סגורה בשעה שנבחרה. אנא בחר שעה אחרת.';
    }

    return '';
  }

  private loadBusinessHours(): void {
    this.isLoadingBusinessHours = true;
    this.businessHoursLoadFailed = false;

    this.businessHoursService.getBusinessHours().pipe(
      finalize(() => {
        this.isLoadingBusinessHours = false;
      })
    ).subscribe({
      next: (businessHours) => {
        this.businessHours = businessHours;
      },
      error: () => {
        this.businessHoursLoadFailed = true;
        this.businessHours = [];
      }
    });
  }

  private selectedBusinessHour(): BusinessHour | null {
    const reservationDate = this.form.controls.reservationDate.value;
    if (!reservationDate) {
      return null;
    }

    const dayOfWeek = new Date(`${reservationDate}T12:00:00`).getDay();
    return this.businessHours.find((businessHour) => businessHour.dayOfWeek === dayOfWeek) ?? null;
  }

  private defaultFormValue(): typeof this.form.value {
    return {
      customerFirstName: '',
      customerLastName: '',
      phoneNumber: '',
      reservationDate: this.todayDate(),
      reservationTime: DEFAULT_RESERVATION_TIME,
      guestCount: DEFAULT_GUEST_COUNT,
      notes: ''
    };
  }

  private todayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

function notPastDateValidator(todayProvider: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) {
      return null;
    }

    return value >= todayProvider() ? null : { pastDate: true };
  };
}
