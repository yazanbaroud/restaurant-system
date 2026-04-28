import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { DEFAULT_API_ERROR_MESSAGE, DEFAULT_SUCCESS_MESSAGE, apiErrorMessage } from '../../shared/api-error-message';

export type FeedbackType = 'success' | 'error' | 'info';

export interface FeedbackMessage {
  type: FeedbackType;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly messageSubject = new BehaviorSubject<FeedbackMessage | null>(null);
  private hideTimer = 0;

  readonly message$ = this.messageSubject.asObservable();

  success(message = DEFAULT_SUCCESS_MESSAGE): void {
    this.show('success', message);
  }

  error(error: unknown, fallback = DEFAULT_API_ERROR_MESSAGE): void {
    this.show('error', apiErrorMessage(error, fallback));
  }

  info(message: string): void {
    this.show('info', message);
  }

  clear(): void {
    if (typeof window !== 'undefined') {
      window.clearTimeout(this.hideTimer);
    }
    this.messageSubject.next(null);
  }

  private show(type: FeedbackType, text: string): void {
    const message = text.trim() || (type === 'success' ? DEFAULT_SUCCESS_MESSAGE : DEFAULT_API_ERROR_MESSAGE);
    this.messageSubject.next({ type, text: message });

    if (typeof window !== 'undefined') {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = window.setTimeout(() => this.messageSubject.next(null), 4200);
    }
  }
}
