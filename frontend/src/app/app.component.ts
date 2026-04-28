import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { RealtimeService } from './core/services/realtime.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class AppComponent {
  private readonly realtime = inject(RealtimeService);

  constructor() {
    void this.realtime;
  }
}
