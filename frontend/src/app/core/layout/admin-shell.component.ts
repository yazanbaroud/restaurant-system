import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="staff-shell" dir="rtl">
      <aside class="sidebar">
        <a class="brand brand--stacked" routerLink="/">
          <span class="brand__mark">הכבש</span>
          <span>
            <strong>מסעדת הכבש</strong>
            <small>ניהול מסעדה</small>
          </span>
        </a>
        <nav class="sidebar__nav" aria-label="ניהול">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">לוח ניהול</a>
          <a routerLink="/admin/orders" routerLinkActive="active">הזמנות</a>
          <a routerLink="/admin/reservations" routerLinkActive="active">הזמנות מקום</a>
          <a routerLink="/admin/menu" routerLinkActive="active">תפריט</a>
          <a routerLink="/admin/tables" routerLinkActive="active">שולחנות</a>
          <a routerLink="/admin/users" routerLinkActive="active">צוות ומשתמשים</a>
          <a routerLink="/admin/payments" routerLinkActive="active">תשלומים</a>
          <a routerLink="/admin/reports" routerLinkActive="active">דוחות</a>
        </nav>
        <button type="button" class="btn btn-ghost" routerLink="/waiter">
          מעבר לתפעול מלצר
        </button>
      </aside>
      <section class="staff-main">
        <header class="staff-topline">
          <div>
            <p class="eyebrow">Luxury Druze Restaurant Experience</p>
            <strong>ממשק מנהל</strong>
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
export class AdminShellComponent {
  readonly auth = inject(AuthService);
}
