import { AsyncPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, catchError, finalize, of, switchMap, tap } from 'rxjs';

import { User, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { controlError, israeliPhoneValidator, strongPasswordValidator } from '../../shared/form-validation';
import { roleLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-users-management-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, ReactiveFormsModule, StatusBadgeComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="צוות ומשתמשים"
        title="ניהול משתמשים ומלצרים"
        subtitle="יצירה, עריכה וניהול הרשאות של צוות המסעדה."
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
          <button type="button" class="btn btn-gold" [disabled]="isSubmitting" (click)="startCreate(UserRole.Customer)">משתמש חדש</button>
          <button type="button" class="btn btn-dark" [disabled]="isSubmitting" (click)="startCreate(UserRole.Waiter)">מלצר חדש</button>
        </div>
      </div>

      @if (isFormOpen) {
        <form class="panel form-grid user-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-heading full">
            <h2>{{ formTitle() }}</h2>
            @if (!editingUserId) {
              <app-status-badge [label]="roleLabels[form.controls.role.value]" tone="gold" />
            }
          </div>

          <label>
            שם פרטי
            <input formControlName="firstName" autocomplete="given-name" />
            @if (fieldError('firstName')) {
              <span class="field-error">{{ fieldError('firstName') }}</span>
            }
          </label>

          <label>
            שם משפחה
            <input formControlName="lastName" autocomplete="family-name" />
            @if (fieldError('lastName')) {
              <span class="field-error">{{ fieldError('lastName') }}</span>
            }
          </label>

          <label>
            דוא"ל
            <input type="email" formControlName="email" autocomplete="email" />
            @if (fieldError('email')) {
              <span class="field-error">{{ fieldError('email') }}</span>
            }
          </label>

          <label>
            טלפון
            <input formControlName="phoneNumber" autocomplete="tel" />
            @if (fieldError('phoneNumber')) {
              <span class="field-error">{{ fieldError('phoneNumber') }}</span>
            }
          </label>

          @if (editingUserId) {
            <label>
              תפקיד
              <select formControlName="role">
                @for (role of formRoles; track role) {
                  <option [ngValue]="role">{{ roleLabels[role] }}</option>
                }
              </select>
            </label>
          } @else {
            <div class="readonly-role">
              <span>תפקיד</span>
              <app-status-badge [label]="roleLabels[form.controls.role.value]" tone="gold" />
            </div>
          }

          @if (!editingUserId) {
            <label>
              סיסמה
              <input type="password" formControlName="password" autocomplete="new-password" />
              @if (fieldError('password')) {
                <span class="field-error">{{ fieldError('password') }}</span>
              }
            </label>
          }

          @if (isEditingCurrentUser()) {
            <p class="validation-note full">לחשבון הפעיל ניתן לעדכן רק פרטים בסיסיים.</p>
          }

          @if (errorMessage) {
            <p class="validation-note full">{{ errorMessage }}</p>
          }

          @if (successMessage) {
            <p class="success-note full">{{ successMessage }}</p>
          }

          <div class="actions-inline full">
            <button class="btn btn-gold" type="submit" [disabled]="isSubmitting">שמירה</button>
            <button class="btn btn-ghost" type="button" [disabled]="isSubmitting" (click)="resetForm()">ביטול</button>
          </div>
        </form>
      }

      @if (!isFormOpen && errorMessage) {
        <p class="validation-note">{{ errorMessage }}</p>
      }

      @if (!isFormOpen && successMessage) {
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
                      <button class="btn btn-small btn-ghost" type="button" [disabled]="isSubmitting" (click)="edit(user)">עריכה</button>
                      <button class="btn btn-small btn-dark" type="button" [disabled]="isSubmitting || isResettingPassword" (click)="startPasswordReset(user)">איפוס סיסמה</button>
                      @if (!isCurrentUser(user)) {
                        <button
                          class="btn btn-small btn-danger"
                          type="button"
                          [disabled]="isSubmitting || isResettingPassword || deletingUserId !== null"
                          (click)="deleteUser(user)"
                        >
                          מחיקה
                        </button>
                      }
                    </div>
                    @if (resettingPasswordUserId === user.id) {
                      <form class="form-grid password-reset-panel" [formGroup]="passwordResetForm" (ngSubmit)="submitPasswordReset(user)">
                        <label>
                          סיסמה חדשה
                          <input type="password" formControlName="newPassword" autocomplete="new-password" />
                          @if (passwordResetFieldError('newPassword')) {
                            <span class="field-error">{{ passwordResetFieldError('newPassword') }}</span>
                          }
                        </label>
                        <label>
                          אימות סיסמה
                          <input type="password" formControlName="confirmPassword" autocomplete="new-password" />
                          @if (passwordResetFieldError('confirmPassword')) {
                            <span class="field-error">{{ passwordResetFieldError('confirmPassword') }}</span>
                          }
                        </label>
                        <div class="actions-inline full">
                          <button class="btn btn-small btn-danger" type="submit" [disabled]="isResettingPassword">שמירת סיסמה חדשה</button>
                          <button class="btn btn-small btn-ghost" type="button" [disabled]="isResettingPassword" (click)="cancelPasswordReset()">ביטול</button>
                        </div>
                      </form>
                    }
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

    .form-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .form-heading h2 {
      margin: 0;
      font-size: 1.35rem;
    }

    .readonly-role {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .readonly-role > span {
      color: var(--muted);
      font-size: 0.9rem;
      font-weight: 700;
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

    .password-reset-panel {
      border-top: 1px solid var(--line);
      margin-top: 0.15rem;
      padding-top: 0.85rem;
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
  private readonly fb = inject(FormBuilder);

  readonly users$: Observable<User[]>;
  readonly roleLabels = roleLabels;
  readonly UserRole = UserRole;
  readonly formRoles = [UserRole.Customer, UserRole.Waiter, UserRole.Admin];
  readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, israeliPhoneValidator()]],
    password: ['', strongPasswordValidator()],
    role: [UserRole.Customer, Validators.required]
  });
  readonly passwordResetForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, strongPasswordValidator()]],
    confirmPassword: ['', Validators.required]
  });

  editingUserId: number | null = null;
  editingOriginalRole: UserRole | null = null;
  isFormOpen = false;
  isSubmitting = false;
  isLoading = true;
  isResettingPassword = false;
  formSubmitted = false;
  passwordResetSubmitted = false;
  resettingPasswordUserId: number | null = null;
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

  startCreate(role: UserRole): void {
    if (this.isSubmitting || this.deletingUserId !== null) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.resettingPasswordUserId = null;
    this.resetForm(role, true);
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.canSubmit()) {
      this.formSubmitted = true;
      if (!this.editingUserId && !this.form.controls.password.value.trim()) {
        this.form.controls.password.setErrors({ required: true });
      }
      this.form.markAllAsTouched();
      this.errorMessage = this.editingUserId
        ? 'מלאו את כל פרטי המשתמש הנדרשים.'
        : 'מלאו את כל הפרטים וסיסמה תקינה.';
      return;
    }

    const value = this.form.getRawValue();
    const shouldUpdateRole = Boolean(
      this.editingUserId &&
      !this.isEditingCurrentUser() &&
      value.role !== this.editingOriginalRole
    );

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const request$ = this.editingUserId
      ? this.data.updateUser(this.editingUserId, {
          firstName: value.firstName,
          lastName: value.lastName,
          email: value.email,
          phoneNumber: value.phoneNumber
        }).pipe(
          switchMap((user) =>
            shouldUpdateRole ? this.data.updateUserRole(user.id, value.role) : of(user)
          )
        )
      : this.data.createUser({
          firstName: value.firstName,
          lastName: value.lastName,
          email: value.email,
          phoneNumber: value.phoneNumber,
          password: value.password,
          role: value.role
        });

    request$.pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: (user) => {
        this.successMessage = `המשתמש ${user.firstName} ${user.lastName} נשמר בהצלחה.`;
        this.resetForm();
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לשמור את המשתמש. בדקו את הפרטים ונסו שוב.';
      }
    });
  }

  startPasswordReset(user: User): void {
    if (this.isResettingPassword || this.deletingUserId !== null) {
      return;
    }

    this.resettingPasswordUserId = user.id;
    this.passwordResetSubmitted = false;
    this.errorMessage = '';
    this.successMessage = '';
    this.passwordResetForm.reset({
      newPassword: '',
      confirmPassword: ''
    });
  }

  cancelPasswordReset(): void {
    this.resettingPasswordUserId = null;
    this.passwordResetSubmitted = false;
    this.passwordResetForm.reset({
      newPassword: '',
      confirmPassword: ''
    });
  }

  submitPasswordReset(user: User): void {
    this.passwordResetSubmitted = true;
    this.passwordResetForm.controls.confirmPassword.setErrors(null);
    if (this.passwordResetForm.controls.newPassword.value !== this.passwordResetForm.controls.confirmPassword.value) {
      this.passwordResetForm.controls.confirmPassword.setErrors({ passwordMismatch: true });
    }

    if (this.passwordResetForm.invalid || this.isResettingPassword) {
      this.passwordResetForm.markAllAsTouched();
      return;
    }

    this.isResettingPassword = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.data.resetUserPassword(user.id, this.passwordResetForm.controls.newPassword.value).pipe(
      finalize(() => {
        this.isResettingPassword = false;
      })
    ).subscribe({
      next: () => {
        this.successMessage = 'הסיסמה עודכנה בהצלחה';
        this.cancelPasswordReset();
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לעדכן את הסיסמה';
      }
    });
  }

  edit(user: User): void {
    if (this.isSubmitting || this.deletingUserId !== null) {
      return;
    }

    this.editingUserId = user.id;
    this.editingOriginalRole = user.role;
    this.isFormOpen = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      password: '',
      role: user.role
    });
    this.resettingPasswordUserId = null;

    if (this.isCurrentUser(user)) {
      this.form.controls.role.disable({ emitEvent: false });
    } else {
      this.form.controls.role.enable({ emitEvent: false });
    }
  }

  resetForm(role = UserRole.Customer, keepOpen = false): void {
    this.editingUserId = null;
    this.editingOriginalRole = null;
    this.isFormOpen = keepOpen;
    this.resettingPasswordUserId = null;
    this.formSubmitted = false;
    this.form.reset({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      role
    });
    if (keepOpen) {
      this.form.controls.role.disable({ emitEvent: false });
    } else {
      this.form.controls.role.enable({ emitEvent: false });
    }
  }

  deleteUser(user: User): void {
    if (this.deletingUserId !== null || this.isCurrentUser(user)) {
      return;
    }

    if (!window.confirm('האם אתה בטוח שברצונך למחוק את המשתמש?')) {
      return;
    }

    if (this.editingUserId === user.id) {
      this.resetForm();
    }

    if (this.resettingPasswordUserId === user.id) {
      this.cancelPasswordReset();
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

  formTitle(): string {
    if (this.editingUserId) {
      return 'עריכת משתמש';
    }

    return this.form.controls.role.value === UserRole.Waiter ? 'יצירת מלצר חדש' : 'יצירת משתמש חדש';
  }

  canSubmit(): boolean {
    if (this.isSubmitting || this.form.invalid) {
      return false;
    }

    return Boolean(this.editingUserId || this.form.controls.password.value.trim().length >= 8);
  }

  isCurrentUser(user: User): boolean {
    return this.auth.currentUser?.id === user.id;
  }

  isEditingCurrentUser(): boolean {
    return this.editingUserId !== null && this.auth.currentUser?.id === this.editingUserId;
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.formSubmitted);
  }

  passwordResetFieldError(controlName: keyof typeof this.passwordResetForm.controls): string {
    return controlError(this.passwordResetForm.controls[controlName], this.passwordResetSubmitted);
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
