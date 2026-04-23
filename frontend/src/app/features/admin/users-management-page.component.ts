import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';

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
        subtitle="רשימת mock לפי roles: מנהל, מלצר ולקוח."
      />
      <div class="resource-grid">
        @for (user of users$ | async; track user.id) {
          <article class="resource-card user-card">
            <div class="inline-between">
              <h3>{{ user.firstName }} {{ user.lastName }}</h3>
              <app-status-badge [label]="roleLabels[user.role]" tone="gold" />
            </div>
            <p>{{ user.email }}</p>
            <p class="muted">{{ user.phoneNumber }}</p>
          </article>
        }
      </div>
    </section>
  `
})
export class UsersManagementPageComponent {
  private readonly data = inject(RestaurantDataService);

  readonly users$ = this.data.getUsers();
  readonly roleLabels = roleLabels;
}
