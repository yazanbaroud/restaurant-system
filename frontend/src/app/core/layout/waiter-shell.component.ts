import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { RealtimeEventName, RealtimeService } from '../services/realtime.service';

type StaffWorkspace = 'waiter' | 'salad' | 'kitchen';

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
            <small>תפעול צוות</small>
          </span>
        </a>
        <nav class="sidebar__nav" aria-label="צוות">
          @if (workspace === 'waiter') {
            <a routerLink="/waiter" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">הזמנות</a>
            <a routerLink="/waiter/create-order" routerLinkActive="active">הזמנה חדשה</a>
          }
          @if (workspace === 'salad') {
            <a routerLink="/salad" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">מסך סלטיה</a>
          }
          @if (workspace === 'kitchen') {
            <a routerLink="/kitchen" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">מסך מטבח</a>
          }
        </nav>
      </aside>
      <section class="staff-main">
        <header class="staff-topline">
          <div>
            <p class="eyebrow">{{ workspaceEyebrow }}</p>
            <strong>{{ workspaceTitle }}</strong>
          </div>
          @if (auth.currentUser$ | async; as user) {
            <div class="actions-inline">
              <div class="user-chip">{{ user.firstName }} {{ user.lastName }}</div>
              <a class="btn btn-small btn-ghost" routerLink="/account">אזור אישי</a>
              <button type="button" class="btn btn-small btn-ghost" (click)="logout()">יציאה</button>
            </div>
          }
        </header>
        @if (realtimeNotice) {
          <div class="realtime-notice" role="status">{{ realtimeNotice }}</div>
        }
        <router-outlet />
      </section>
    </div>
  `,
  styles: [`
    .realtime-notice {
      margin-bottom: 0.85rem;
      padding: 10px 12px;
      border: 1px solid rgba(102, 112, 68, 0.26);
      border-radius: var(--radius);
      background: rgba(102, 112, 68, 0.12);
      color: var(--olive-dark);
      font-weight: 850;
    }
  `]
})
export class WaiterShellComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private noticeTimer = 0;

  realtimeNotice = '';

  constructor() {
    this.realtime.events$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event) => this.showRealtimeNotice(event.name));
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  get workspace(): StaffWorkspace {
    const path = this.router.url.split(/[?#]/)[0];
    if (path === '/salad' || path.startsWith('/salad/')) {
      return 'salad';
    }

    if (path === '/kitchen' || path.startsWith('/kitchen/')) {
      return 'kitchen';
    }

    return 'waiter';
  }

  get workspaceEyebrow(): string {
    if (this.workspace === 'salad') {
      return 'תחנת סלטיה';
    }

    if (this.workspace === 'kitchen') {
      return 'תחנת מטבח';
    }

    return 'מהיר, ברור, מותאם למשמרת';
  }

  get workspaceTitle(): string {
    if (this.workspace === 'salad') {
      return 'ממשק סלטיה';
    }

    if (this.workspace === 'kitchen') {
      return 'ממשק מטבח';
    }

    return 'ממשק מלצרים';
  }

  private showRealtimeNotice(eventName: RealtimeEventName): void {
    const message = this.realtimeNoticeFor(eventName);
    if (!message) {
      return;
    }

    this.realtimeNotice = message;
    if (typeof window !== 'undefined') {
      window.clearTimeout(this.noticeTimer);
      this.noticeTimer = window.setTimeout(() => {
        this.realtimeNotice = '';
      }, 4500);
    }
  }

  private realtimeNoticeFor(eventName: RealtimeEventName): string {
    const messages: Record<RealtimeEventName, string> = {
      orderCreated: 'התקבלה הזמנה חדשה.',
      orderUpdated: 'הזמנה עודכנה.',
      orderStatusUpdated: 'סטטוס הזמנה עודכן.',
      paymentAdded: '',
      reservationCreated: 'התקבלה הזמנת מקום חדשה.',
      reservationStatusUpdated: 'סטטוס הזמנת מקום עודכן.'
    };

    return messages[eventName];
  }
}
