import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, finalize, of, tap } from 'rxjs';

import { User, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { roleLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-users-management-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="צוות ומשתמשים"
        title="ניהול משתמשים ומלצרים"
        subtitle="חיפוש, עריכה וניהול הרשאות של צוות ומשתמשי המסעדה."
      />

      <div class="panel users-toolbar">
        <label class="toolbar-search">
          חיפוש משתמשים
          <input
            #userSearch
            type="search"
            [value]="searchTerm"
            (input)="searchTerm = userSearch.value"
            placeholder="חיפוש לפי שם, אימייל או טלפון"
            autocomplete="off"
          />
        </label>

        <label class="toolbar-filter">
          תפקיד
          <select #roleFilterSelect [value]="roleFilterValue()" (change)="setRoleFilter(roleFilterSelect.value)">
            <option value="all">הכל</option>
            <option [value]="roleOptionValue(UserRole.Admin)">מנהל</option>
            <option [value]="roleOptionValue(UserRole.Waiter)">מלצר</option>
            <option [value]="roleOptionValue(UserRole.Customer)">לקוח</option>
          </select>
        </label>

        <div class="actions-inline toolbar-actions">
          <a class="btn btn-gold" [routerLink]="['/admin/users/new']" [queryParams]="{ role: 'customer' }">משתמש חדש</a>
          <a class="btn btn-dark" [routerLink]="['/admin/users/new']" [queryParams]="{ role: 'waiter' }">מלצר חדש</a>
        </div>
      </div>

      @if (errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (successMessage) {
        <p class="success-note">{{ successMessage }}</p>
      }

      @if (users$ | async; as users) {
        @if (isLoading) {
          <div class="empty-state">
            <h2>טוען משתמשים...</h2>
          </div>
        } @else {
          @if (filteredUsers(users); as visibleUsers) {
            <div class="users-list-header">
              <p>מציג {{ visibleUsers.length }} מתוך {{ users.length }} משתמשים</p>
            </div>

            @if (!users.length) {
              <div class="empty-state">
                <h2>לא נמצאו משתמשים</h2>
              </div>
            } @else if (visibleUsers.length) {
              <div class="resource-grid users-grid">
                @for (user of visibleUsers; track user.id) {
                  <article class="resource-card user-card">
                    <div class="inline-between user-card-header">
                      <h3>{{ user.firstName }} {{ user.lastName }}</h3>
                      <app-status-badge [label]="roleLabels[user.role]" tone="gold" />
                    </div>

                    <div class="user-card-meta">
                      <p>{{ user.email }}</p>
                      <p class="muted">{{ user.phoneNumber || 'אין טלפון שמור' }}</p>
                    </div>

                    <div class="actions-inline user-card-actions">
                      <a class="btn btn-small btn-ghost" [routerLink]="['/admin/users', user.id, 'edit']">עריכה</a>
                      <a class="btn btn-small btn-dark" [routerLink]="['/admin/users', user.id, 'edit']" [queryParams]="{ resetPassword: true }">איפוס סיסמה</a>
                      @if (!isCurrentUser(user)) {
                        <button
                          class="btn btn-small btn-danger"
                          type="button"
                          [disabled]="deletingUserId !== null"
                          (click)="deleteUser(user)"
                        >
                          מחיקה
                        </button>
                      }
                    </div>
                  </article>
                }
              </div>
            } @else {
              <div class="empty-state">
                <h2>לא נמצאו משתמשים מתאימים</h2>
              </div>
            }
          }
        }
      } @else {
        <div class="empty-state">
          <h2>טוען משתמשים...</h2>
        </div>
      }
    </section>
  `,
  styles: [`
    .users-toolbar {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(150px, 220px) auto;
      align-items: end;
      gap: 1rem;
      position: sticky;
      top: 0.75rem;
      z-index: 1;
    }

    .toolbar-actions {
      justify-content: flex-end;
    }

    .users-grid {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .users-list-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      color: var(--muted);
      font-weight: 800;
      margin-block: -0.25rem 0.8rem;
    }

    .users-list-header p {
      margin: 0;
    }

    .user-card {
      gap: 0.75rem;
      min-height: 190px;
    }

    .user-card-header {
      align-items: flex-start;
      gap: 0.75rem;
    }

    .user-card-header h3,
    .user-card-meta p {
      margin: 0;
    }

    .user-card-meta {
      display: grid;
      gap: 0.2rem;
      overflow-wrap: anywhere;
    }

    .user-card-actions {
      margin-top: auto;
      padding-top: 0.35rem;
    }

    @media (max-width: 760px) {
      .users-toolbar {
        position: static;
        grid-template-columns: 1fr;
      }

      .toolbar-actions {
        justify-content: flex-start;
      }

      .toolbar-actions .btn {
        flex: 1 1 150px;
      }

      .users-grid {
        grid-template-columns: 1fr;
      }

      .users-list-header {
        justify-content: flex-start;
      }
    }
  `]
})
export class UsersManagementPageComponent {
  private readonly data = inject(RestaurantDataService);
  private readonly auth = inject(AuthService);

  readonly users$: Observable<User[]>;
  readonly roleLabels = roleLabels;
  readonly UserRole = UserRole;

  isLoading = true;
  deletingUserId: number | null = null;
  searchTerm = '';
  roleFilter: UserRole | 'all' = 'all';
  errorMessage = '';
  successMessage = '';

  constructor() {
    this.users$ = this.data.getUsers().pipe(
      tap(() => {
        this.isLoading = false;
      }),
      catchError(() => {
        this.errorMessage = 'לא הצלחנו לטעון את רשימת המשתמשים.';
        this.isLoading = false;
        return of([]);
      })
    );
  }

  deleteUser(user: User): void {
    if (this.deletingUserId !== null || this.isCurrentUser(user)) {
      return;
    }

    if (!window.confirm('האם אתה בטוח שברצונך למחוק את המשתמש?')) {
      return;
    }

    this.deletingUserId = user.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.data.deleteUser(user.id).pipe(
      finalize(() => {
        this.deletingUserId = null;
      })
    ).subscribe({
      next: () => {
        this.successMessage = 'המשתמש נמחק בהצלחה';
      },
      error: (error: unknown) => {
        this.errorMessage = this.deleteUserErrorMessage(error);
      }
    });
  }

  setRoleFilter(value: string): void {
    this.roleFilter = value === 'all' ? 'all' : Number(value) as UserRole;
  }

  roleFilterValue(): string {
    return this.roleFilter === 'all' ? 'all' : this.roleOptionValue(this.roleFilter);
  }

  roleOptionValue(role: UserRole): string {
    return String(role);
  }

  filteredUsers(users: User[]): User[] {
    const search = this.normalizeSearch(this.searchTerm);

    return users.filter((user) => {
      if (this.roleFilter !== 'all' && user.role !== this.roleFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const firstName = user.firstName ?? '';
      const lastName = user.lastName ?? '';
      const searchableText = [
        firstName,
        lastName,
        `${firstName} ${lastName}`,
        `${lastName} ${firstName}`,
        user.email ?? '',
        user.phoneNumber ?? ''
      ].join(' ').toLowerCase();

      return searchableText.includes(search);
    });
  }

  isCurrentUser(user: User): boolean {
    return this.auth.currentUser?.id === user.id;
  }

  private deleteUserErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.backendErrorMessage(error);
      if (backendMessage) {
        return backendMessage;
      }
    }

    return 'לא הצלחנו למחוק את המשתמש';
  }

  private backendErrorMessage(error: HttpErrorResponse): string {
    const payload = error.error;
    if (typeof payload === 'string') {
      return payload.trim();
    }

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const message = record['title'] ?? record['message'] ?? record['error'];
      return typeof message === 'string' ? message.trim() : '';
    }

    return '';
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }
}
