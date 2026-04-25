import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { roleLabels } from '../../shared/ui-labels';
import { UserRole } from '../models';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [AsyncPipe, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="app-shell public-shell" dir="rtl">
      <header class="topbar">
        <a class="brand" routerLink="/">
          <span class="brand__mark">הכבש</span>
          <span>
            <strong>מסעדת הכבש</strong>
            <small>דליית אל־כרמל</small>
          </span>
        </a>
        <nav class="topbar__nav" aria-label="ניווט ראשי">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">בית</a>
          <a routerLink="/menu" routerLinkActive="active">תפריט</a>
          <a routerLink="/reservation" routerLinkActive="active">הזמנת מקום</a>
        </nav>
        <div class="role-switch">
          @if (auth.currentUser$ | async; as user) {
            <span>{{ roleLabels[user.role] }}</span>
            @if (user.role === UserRole.Admin) {
              <a class="btn btn-small btn-dark" routerLink="/admin">חזרה לממשק מנהל</a>
            }
            @if (user.role === UserRole.Waiter) {
              <a class="btn btn-small btn-dark" routerLink="/waiter">חזרה לממשק מלצר</a>
            }
            <button type="button" class="btn btn-small btn-ghost" (click)="logout()">התנתקות</button>
          } @else {
            <a class="btn btn-small btn-dark" routerLink="/login" routerLinkActive="active">התחברות</a>
          }
        </div>
      </header>
      <main>
        <router-outlet />
      </main>
    </div>
  `
})
export class PublicShellComponent {
  readonly auth = inject(AuthService);
  readonly router = inject(Router);
  readonly roleLabels = roleLabels;
  readonly UserRole = UserRole;

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
