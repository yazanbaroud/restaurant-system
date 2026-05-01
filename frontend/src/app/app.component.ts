import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NetworkStatusService } from './core/services/network-status.service';
import { RealtimeService } from './core/services/realtime.service';
import { FeedbackToastComponent } from './shared/components/feedback-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, FeedbackToastComponent, RouterOutlet],
  template: `
    <app-feedback-toast />
    @if ((network.online$ | async) === false) {
      <div class="offline-banner" role="alert">אין חיבור לאינטרנט</div>
    }
    <router-outlet />
  `,
  styles: [`
    .offline-banner {
      position: sticky;
      top: 0;
      z-index: 1000;
      padding: 0.7rem 1rem;
      background: #7f1d1d;
      color: #fff;
      text-align: center;
      font-weight: 900;
      letter-spacing: 0.02em;
    }
  `]
})
export class AppComponent {
  readonly network = inject(NetworkStatusService);
  private readonly realtime = inject(RealtimeService);

  constructor() {
    void this.realtime;
  }
}
