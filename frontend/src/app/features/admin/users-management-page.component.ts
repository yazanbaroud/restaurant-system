import { AsyncPipe } from '@angular/common';
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

      <div class="actions-inline">
        <button type="button" class="btn btn-gold" [disabled]="isSubmitting" (click)="startCreate(UserRole.Customer)">משתמש חדש</button>
        <button type="button" class="btn btn-dark" [disabled]="isSubmitting" (click)="startCreate(UserRole.Waiter)">מלצר חדש</button>
      </div>

      <form class="panel form-grid" [formGroup]="form" (ngSubmit)="submit()">
        <h2 class="full">{{ editingUserId ? 'עריכת משתמש' : 'יצירת משתמש' }}</h2>

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

        <label>
          תפקיד
          <select formControlName="role">
            @for (role of formRoles; track role) {
              <option [ngValue]="role">{{ roleLabels[role] }}</option>
            }
          </select>
        </label>

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
          @if (editingUserId) {
            <button class="btn btn-ghost" type="button" [disabled]="isSubmitting" (click)="resetForm()">ביטול</button>
          }
        </div>
      </form>

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

                @if (canQuickChangeRole(user)) {
                  <label>
                    שינוי תפקיד
                    <select #roleSelect [value]="user.role" [disabled]="isBusy(user.id)" (change)="changeRole(user, roleSelect.value)">
                      @for (role of quickRoles; track role) {
                        <option [value]="role">{{ roleLabels[role] }}</option>
                      }
                    </select>
                  </label>
                } @else if (isCurrentUser(user)) {
                  <p class="muted">לא ניתן לשנות את התפקיד של החשבון הפעיל.</p>
                } @else {
                  <p class="muted">תפקיד מנהל משתנה רק דרך טופס העריכה.</p>
                }

                <div class="actions-inline">
                  <button class="btn btn-small btn-ghost" type="button" [disabled]="isSubmitting || isBusy(user.id)" (click)="edit(user)">עריכה</button>
                  <button class="btn btn-small btn-dark" type="button" [disabled]="isSubmitting || isBusy(user.id)" (click)="startPasswordReset(user)">איפוס סיסמה</button>
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
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly users$: Observable<User[]>;
  readonly roleLabels = roleLabels;
  readonly UserRole = UserRole;
  readonly formRoles = [UserRole.Customer, UserRole.Waiter, UserRole.Admin];
  readonly quickRoles = [UserRole.Customer, UserRole.Waiter];
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
  actingUserId: number | null = null;
  isSubmitting = false;
  isLoading = true;
  isResettingPassword = false;
  formSubmitted = false;
  passwordResetSubmitted = false;
  resettingPasswordUserId: number | null = null;
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
    if (this.isSubmitting) {
      return;
    }

    this.resetForm(role);
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
    if (this.isResettingPassword) {
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
    if (this.isSubmitting || this.actingUserId) {
      return;
    }

    this.editingUserId = user.id;
    this.editingOriginalRole = user.role;
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

    if (this.isCurrentUser(user)) {
      this.form.controls.role.disable({ emitEvent: false });
    } else {
      this.form.controls.role.enable({ emitEvent: false });
    }
  }

  changeRole(user: User, rawRole: string): void {
    const role = Number(rawRole) as UserRole;
    if (
      this.actingUserId ||
      role === user.role ||
      this.isCurrentUser(user) ||
      user.role === UserRole.Admin ||
      !this.quickRoles.includes(role)
    ) {
      return;
    }

    this.actingUserId = user.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.data.updateUserRole(user.id, role).pipe(
      finalize(() => {
        this.actingUserId = null;
      })
    ).subscribe({
      next: () => {
        this.successMessage = 'התפקיד עודכן בהצלחה.';
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לעדכן את התפקיד.';
      }
    });
  }

  resetForm(role = UserRole.Customer): void {
    this.editingUserId = null;
    this.editingOriginalRole = null;
    this.formSubmitted = false;
    this.form.reset({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      role
    });
    this.form.controls.role.enable({ emitEvent: false });
  }

  canSubmit(): boolean {
    if (this.isSubmitting || this.form.invalid) {
      return false;
    }

    return Boolean(this.editingUserId || this.form.controls.password.value.trim().length >= 8);
  }

  isBusy(id: number): boolean {
    return this.actingUserId === id;
  }

  isCurrentUser(user: User): boolean {
    return this.auth.currentUser?.id === user.id;
  }

  isEditingCurrentUser(): boolean {
    return this.editingUserId !== null && this.auth.currentUser?.id === this.editingUserId;
  }

  canQuickChangeRole(user: User): boolean {
    return !this.isCurrentUser(user) && user.role !== UserRole.Admin;
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.formSubmitted);
  }

  passwordResetFieldError(controlName: keyof typeof this.passwordResetForm.controls): string {
    return controlError(this.passwordResetForm.controls[controlName], this.passwordResetSubmitted);
  }
}
