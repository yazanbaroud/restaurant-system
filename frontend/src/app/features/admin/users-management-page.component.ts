import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Observable, catchError, finalize, of } from 'rxjs';

import { User } from '../../core/models';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { roleLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-users-management-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="צוות ומשתמשים"
        title="ניהול משתמשים ומלצרים"
        subtitle="תצוגה לקריאת משתמשי המערכת והרשאותיהם."
      />

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (users$ | async; as users) {
        @if (isLoading) {
          <div class="empty-state">
            <h2>טוען משתמשים...</h2>
          </div>
        } @else if (users.length) {
          <div class="resource-grid">
            @for (user of users; track user.id) {
              <article class="resource-card user-card">
                <div class="inline-between">
                  <h3>{{ user.firstName }} {{ user.lastName }}</h3>
                  <app-status-badge [label]="roleLabels[user.role]" tone="gold" />
                </div>
                <p>{{ user.email }}</p>
                <p class="muted">{{ user.phoneNumber || 'אין טלפון שמור' }}</p>
              </article>
            }
          </div>
        } @else {
          <div class="empty-state">
            <h2>לא נמצאו משתמשים</h2>
          </div>
        }
      } @else {
        <div class="empty-state">
          <h2>טוען משתמשים...</h2>
        </div>
      }
    </section>
  `
})
export class UsersManagementPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly users$: Observable<User[]>;
  readonly roleLabels = roleLabels;
  isLoading = true;
  errorMessage = '';

  constructor() {
    this.users$ = this.data.getUsers().pipe(
      catchError(() => {
        this.errorMessage = 'לא הצלחנו לטעון את רשימת המשתמשים. מוצגת רשימה חלופית אם קיימת.';
        return of([]);
      }),
      finalize(() => {
        this.isLoading = false;
      })
    );
  }
}
