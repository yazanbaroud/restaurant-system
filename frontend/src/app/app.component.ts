import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { RealtimeService } from './core/services/realtime.service';
import { FeedbackToastComponent } from './shared/components/feedback-toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FeedbackToastComponent, RouterOutlet],
  template: '<app-feedback-toast /><router-outlet />'
})
export class AppComponent {
  private readonly realtime = inject(RealtimeService);

  constructor() {
    void this.realtime;
  }
}
