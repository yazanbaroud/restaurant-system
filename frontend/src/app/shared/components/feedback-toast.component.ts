import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

import { FeedbackService } from '../../core/services/feedback.service';

@Component({
  selector: 'app-feedback-toast',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (feedback.message$ | async; as message) {
      <aside
        class="feedback-toast"
        [class.feedback-toast--success]="message.type === 'success'"
        [class.feedback-toast--error]="message.type === 'error'"
        [class.feedback-toast--info]="message.type === 'info'"
        [attr.role]="message.type === 'error' ? 'alert' : 'status'"
        dir="rtl"
      >
        <span>{{ message.text }}</span>
        <button type="button" aria-label="סגירת הודעה" (click)="feedback.clear()">&times;</button>
      </aside>
    }
  `,
  styles: [`
    .feedback-toast {
      position: fixed;
      inset-block-start: 16px;
      inset-inline-start: 16px;
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      max-width: min(420px, calc(100vw - 32px));
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 248, 237, 0.98);
      box-shadow: 0 18px 44px rgba(31, 21, 17, 0.16);
      color: var(--brown-950);
      font-weight: 850;
    }

    .feedback-toast--success {
      border-color: rgba(102, 112, 68, 0.28);
      background: rgba(241, 246, 225, 0.98);
      color: var(--olive-dark);
    }

    .feedback-toast--error {
      border-color: rgba(124, 38, 48, 0.24);
      background: rgba(255, 240, 240, 0.98);
      color: var(--burgundy);
    }

    .feedback-toast--info {
      border-color: rgba(199, 154, 59, 0.28);
      background: rgba(255, 249, 231, 0.98);
      color: var(--gold-dark);
    }

    .feedback-toast span {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .feedback-toast button {
      display: inline-grid;
      flex: 0 0 auto;
      place-items: center;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 999px;
      background: rgba(31, 21, 17, 0.08);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 1.1rem;
      font-weight: 950;
      line-height: 1;
    }

    @media (max-width: 640px) {
      .feedback-toast {
        inset-inline: 12px;
        inset-block-start: 12px;
        max-width: none;
      }
    }
  `]
})
export class FeedbackToastComponent {
  readonly feedback = inject(FeedbackService);
}
