import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { UserRole } from '../models';
import { AuthService } from '../services/auth.service';
import { roleLabels } from '../../shared/ui-labels';

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
          <a routerLink="/login" routerLinkActive="active">כניסה</a>
        </nav>
        <div class="role-switch">
          @if (auth.currentUser$ | async; as user) {
            <span>{{ roleLabels[user.role] }}</span>
            <button type="button" class="btn btn-small btn-ghost" (click)="logout()">יציאה</button>
          }
          <button type="button" class="btn btn-small btn-ghost" (click)="goToStaff(UserRole.Waiter, '/waiter')">מלצר</button>
          <button type="button" class="btn btn-small btn-dark" (click)="goToStaff(UserRole.Admin, '/admin')">מנהל</button>
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

  goToStaff(role: UserRole, path: string): void {
    void this.router.navigate(['/login'], {
      queryParams: { role, returnUrl: path }
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
