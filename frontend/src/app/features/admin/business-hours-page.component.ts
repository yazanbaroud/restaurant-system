import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { BusinessHour, UpdateBusinessHourInput } from '../../core/models';
import { BusinessHoursService } from '../../core/services/business-hours.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { apiErrorMessage } from '../../shared/api-error-message';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

interface BusinessHourRow extends UpdateBusinessHourInput {
  id: number;
  label: string;
}

@Component({
  selector: 'app-business-hours-page',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent],
  template: `
    <section class="page-surface business-hours-page">
      <app-page-header
        eyebrow="הגדרות"
        title="שעות פעילות"
        subtitle="ניהול ימי ושעות הפעילות שמוצגים ללקוחות ומשמשים לאימות הזמנות מקום."
      />

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (isLoading) {
        <div class="empty-state">
          <h2>טוען שעות פעילות...</h2>
        </div>
      } @else {
        <form class="panel business-hours-panel" (ngSubmit)="save()" novalidate>
          <div class="business-hours-panel__header">
            <div>
              <h2>ימי השבוע</h2>
              <p>יום סגור לא יאפשר הזמנת מקום בתאריך המתאים.</p>
            </div>
            <button class="btn btn-gold" type="submit" [disabled]="isSaving">
              {{ isSaving ? 'שומרים...' : 'שמירת שעות פעילות' }}
            </button>
          </div>

          <div class="business-hours-list">
            @for (hour of hours; track hour.dayOfWeek; let i = $index) {
              <article class="business-hour-row" [class.business-hour-row--closed]="!hour.isOpen">
                <div class="business-hour-row__day">
                  <strong>{{ hour.label }}</strong>
                  <label class="toggle-line">
                    <input
                      type="checkbox"
                      [name]="'isOpen-' + hour.dayOfWeek"
                      [(ngModel)]="hour.isOpen"
                      (ngModelChange)="handleOpenChange(hour)"
                    />
                    <span>{{ hour.isOpen ? 'פתוח' : 'סגור' }}</span>
                  </label>
                </div>

                <label>
                  פתיחה
                  <input
                    type="time"
                    [name]="'openTime-' + hour.dayOfWeek"
                    [(ngModel)]="hour.openTime"
                    [disabled]="!hour.isOpen"
                  />
                </label>

                <label>
                  סגירה
                  <input
                    type="time"
                    [name]="'closeTime-' + hour.dayOfWeek"
                    [(ngModel)]="hour.closeTime"
                    [disabled]="!hour.isOpen"
                  />
                </label>

                <div class="business-hour-row__summary">
                  @if (hour.isOpen) {
                    <span>פתוחים בין {{ hour.openTime || '--:--' }} ל־{{ hour.closeTime || '--:--' }}</span>
                  } @else {
                    <span>המסעדה סגורה ביום זה</span>
                  }
                </div>
              </article>
            }
          </div>
        </form>
      }
    </section>
  `,
  styles: [`
    .business-hours-page {
      display: grid;
      gap: 1rem;
    }

    .business-hours-panel {
      display: grid;
      gap: 1rem;
    }

    .business-hours-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--line);
    }

    .business-hours-panel__header h2,
    .business-hours-panel__header p {
      margin: 0;
    }

    .business-hours-panel__header p {
      margin-top: 0.25rem;
      color: var(--muted);
      font-weight: 800;
    }

    .business-hours-list {
      display: grid;
      gap: 0.75rem;
    }

    .business-hour-row {
      display: grid;
      grid-template-columns: minmax(150px, 1fr) 140px 140px minmax(190px, 1fr);
      align-items: center;
      gap: 0.9rem;
      padding: 0.85rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.66);
    }

    .business-hour-row--closed {
      background: rgba(31, 21, 17, 0.04);
    }

    .business-hour-row__day {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .business-hour-row label {
      display: grid;
      gap: 0.35rem;
      color: var(--brown-950);
      font-weight: 900;
    }

    .business-hour-row input[type='time'] {
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 0 0.75rem;
      background: rgba(255, 255, 255, 0.9);
      color: var(--brown-950);
      font: inherit;
    }

    .business-hour-row input[type='time']:disabled {
      opacity: 0.55;
    }

    .toggle-line {
      display: inline-flex !important;
      grid-auto-flow: column;
      align-items: center;
      gap: 0.45rem !important;
      font-weight: 900;
      white-space: nowrap;
    }

    .toggle-line input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--olive);
    }

    .business-hour-row__summary {
      color: var(--muted);
      font-weight: 850;
    }

    @media (max-width: 900px) {
      .business-hour-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .business-hour-row__day,
      .business-hour-row__summary {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 620px) {
      .business-hours-panel__header {
        align-items: stretch;
        flex-direction: column;
      }

      .business-hour-row {
        grid-template-columns: 1fr;
      }

      .business-hour-row__day,
      .business-hour-row__summary {
        grid-column: auto;
      }
    }
  `]
})
export class BusinessHoursPageComponent {
  private readonly businessHours = inject(BusinessHoursService);
  private readonly feedback = inject(FeedbackService);

  private readonly dayLabels = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  hours: BusinessHourRow[] = [];
  isLoading = true;
  isSaving = false;
  errorMessage = '';

  constructor() {
    this.load();
  }

  handleOpenChange(hour: BusinessHourRow): void {
    if (hour.isOpen) {
      hour.openTime ||= '10:00';
      hour.closeTime ||= '23:00';
    }
  }

  save(): void {
    if (this.isSaving) {
      return;
    }

    const validationMessage = this.validationMessage();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.feedback.error(null, validationMessage);
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.businessHours.updateBusinessHours(this.hours).pipe(
      finalize(() => {
        this.isSaving = false;
      })
    ).subscribe({
      next: (hours) => {
        this.hours = this.toRows(hours);
        this.feedback.success();
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error);
        this.feedback.error(error, this.errorMessage);
      }
    });
  }

  private load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.businessHours.getAdminBusinessHours().pipe(
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe({
      next: (hours) => {
        this.hours = this.toRows(hours);
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'לא הצלחנו לטעון את שעות הפעילות.');
        this.feedback.error(error, this.errorMessage);
        this.hours = this.defaultRows();
      }
    });
  }

  private toRows(hours: BusinessHour[]): BusinessHourRow[] {
    const byDay = new Map(hours.map((hour) => [hour.dayOfWeek, hour]));

    return this.dayLabels.map((label, dayOfWeek) => {
      const hour = byDay.get(dayOfWeek);
      return {
        id: hour?.id ?? 0,
        dayOfWeek,
        label,
        isOpen: hour?.isOpen ?? true,
        openTime: hour?.openTime ?? '10:00',
        closeTime: hour?.closeTime ?? '23:00'
      };
    });
  }

  private defaultRows(): BusinessHourRow[] {
    return this.toRows([]);
  }

  private validationMessage(): string {
    if (this.hours.length !== 7) {
      return 'יש להגדיר את כל ימות השבוע.';
    }

    for (const hour of this.hours) {
      if (!hour.isOpen) {
        continue;
      }

      if (!hour.openTime || !hour.closeTime) {
        return `יש להזין שעות פתיחה וסגירה ליום ${hour.label}.`;
      }

      if (hour.openTime >= hour.closeTime) {
        return `ביום ${hour.label}, שעת הפתיחה חייבת להיות לפני שעת הסגירה.`;
      }
    }

    return '';
  }
}
