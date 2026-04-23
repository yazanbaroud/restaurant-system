import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-waiter-shell',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="staff-shell waiter-shell" dir="rtl">
      <aside class="sidebar sidebar--compact">
        <a class="brand brand--stacked" routerLink="/">
          <span class="brand__mark">הכבש</span>
          <span>
            <strong>מסעדת הכבש</strong>
            <small>תפעול מלצרים</small>
          </span>
        </a>
        <nav class="sidebar__nav" aria-label="מלצר">
          <a routerLink="/waiter" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">הזמנות פעילות</a>
          <a routerLink="/waiter/create-order" routerLinkActive="active">הזמנה חדשה</a>
          <a routerLink="/waiter/reservations" routerLinkActive="active">הזמנות מקום</a>
        </nav>
        <button type="button" class="btn btn-ghost" routerLink="/admin">
          תצוגת מנהל
        </button>
      </aside>
      <section class="staff-main">
        <header class="staff-topline">
          <div>
            <p class="eyebrow">מהיר, ברור, מותאם למשמרת</p>
            <strong>ממשק מלצר</strong>
          </div>
          @if (auth.currentUser$ | async; as user) {
            <div class="user-chip">{{ user.firstName }} {{ user.lastName }}</div>
          }
        </header>
        <router-outlet />
      </section>
    </div>
  `
})
export class WaiterShellComponent {
  readonly auth = inject(AuthService);
}
