import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';

import { User, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { RestaurantDataService } from '../../core/services/restaurant-data.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { controlError, israeliPhoneValidator, strongPasswordValidator } from '../../shared/form-validation';
import { roleLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-user-form-page',
  standalone: true,
  imports: [PageHeaderComponent, ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-surface">
      <app-page-header
        eyebrow="צוות ומשתמשים"
        [title]="formTitle()"
        [subtitle]="editingUserId ? 'עדכון פרטי משתמש והרשאות.' : 'יצירת משתמש חדש עם תפקיד מוגדר מראש.'"
      >
        <a class="btn btn-ghost" routerLink="/admin/users">חזרה למשתמשים</a>
      </app-page-header>

      @if (isLoadingUser) {
        <div class="empty-state">
          <h2>טוען משתמש...</h2>
        </div>
      } @else if (userLoadError) {
        <div class="empty-state">
          <h2>{{ userLoadError }}</h2>
          <a class="btn btn-gold" routerLink="/admin/users">חזרה למשתמשים</a>
        </div>
      } @else {
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

          <div class="actions-inline full">
            <button class="btn btn-gold" type="submit" [disabled]="isSubmitting">שמירה</button>
            <a class="btn btn-ghost" routerLink="/admin/users">ביטול</a>
          </div>
        </form>

        @if (editingUserId) {
          <section class="panel password-section">
            <div class="inline-between password-section__header">
              <div>
                <h2>איפוס סיסמה</h2>
                <p class="muted">הגדרת סיסמה חדשה למשתמש בלי לחשוף את הסיסמה הקודמת.</p>
              </div>
              @if (!isPasswordResetOpen) {
                <button class="btn btn-small btn-dark" type="button" (click)="openPasswordReset()">איפוס סיסמה</button>
              }
            </div>

            @if (isPasswordResetOpen) {
              <form class="form-grid password-reset-panel" [formGroup]="passwordResetForm" (ngSubmit)="submitPasswordReset()">
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

            @if (passwordMessage) {
              <p class="success-note">{{ passwordMessage }}</p>
            }

            @if (passwordError) {
              <p class="validation-note">{{ passwordError }}</p>
            }
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .form-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .form-heading h2,
    .password-section h2 {
      margin: 0;
      font-size: 1.35rem;
    }

    .password-section {
      display: grid;
      gap: 1rem;
    }

    .password-section__header {
      align-items: flex-start;
      gap: 1rem;
    }

    .password-section__header p {
      margin: 0.25rem 0 0;
    }

    .password-reset-panel {
      border-top: 1px solid var(--line);
      padding-top: 0.85rem;
    }

    @media (max-width: 640px) {
      .password-section__header {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `]
})
export class UserFormPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly data = inject(RestaurantDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
  isLoadingUser = false;
  isSubmitting = false;
  isPasswordResetOpen = false;
  isResettingPassword = false;
  formSubmitted = false;
  passwordResetSubmitted = false;
  errorMessage = '';
  userLoadError = '';
  passwordError = '';
  passwordMessage = '';

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.setupCreateForm();
      return;
    }

    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      this.userLoadError = 'לא מצאנו את המשתמש המבוקש.';
      return;
    }

    this.editingUserId = id;
    this.isPasswordResetOpen = this.route.snapshot.queryParamMap.get('resetPassword') === 'true';
    this.loadUser(id);
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
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        void this.router.navigate(['/admin/users']);
      },
      error: () => {
        this.errorMessage = 'לא הצלחנו לשמור את המשתמש. בדקו את הפרטים ונסו שוב.';
      }
    });
  }

  openPasswordReset(): void {
    this.isPasswordResetOpen = true;
    this.passwordError = '';
    this.passwordMessage = '';
  }

  cancelPasswordReset(): void {
    this.isPasswordResetOpen = false;
    this.passwordResetSubmitted = false;
    this.passwordError = '';
    this.passwordResetForm.reset({
      newPassword: '',
      confirmPassword: ''
    });
  }

  submitPasswordReset(): void {
    if (!this.editingUserId) {
      return;
    }

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
    this.passwordError = '';
    this.passwordMessage = '';
    this.data.resetUserPassword(this.editingUserId, this.passwordResetForm.controls.newPassword.value).pipe(
      finalize(() => {
        this.isResettingPassword = false;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.passwordMessage = 'הסיסמה עודכנה בהצלחה';
        this.cancelPasswordReset();
      },
      error: () => {
        this.passwordError = 'לא הצלחנו לעדכן את הסיסמה';
      }
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

  isEditingCurrentUser(): boolean {
    return this.editingUserId !== null && this.auth.currentUser?.id === this.editingUserId;
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.formSubmitted);
  }

  passwordResetFieldError(controlName: keyof typeof this.passwordResetForm.controls): string {
    return controlError(this.passwordResetForm.controls[controlName], this.passwordResetSubmitted);
  }

  private setupCreateForm(): void {
    const role = this.createRoleFromQuery();
    this.form.reset({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      role
    });
    this.form.controls.role.disable({ emitEvent: false });
  }

  private loadUser(id: number): void {
    this.isLoadingUser = true;
    this.data.getUser(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (user) => {
        this.isLoadingUser = false;
        if (!user) {
          this.userLoadError = 'לא מצאנו את המשתמש המבוקש.';
          return;
        }

        this.fillEditForm(user);
      },
      error: () => {
        this.isLoadingUser = false;
        this.userLoadError = 'לא הצלחנו לטעון את המשתמש. נסו שוב בעוד רגע.';
      }
    });
  }

  private fillEditForm(user: User): void {
    this.editingOriginalRole = user.role;
    this.form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      password: '',
      role: user.role
    });

    if (this.auth.currentUser?.id === user.id) {
      this.form.controls.role.disable({ emitEvent: false });
    } else {
      this.form.controls.role.enable({ emitEvent: false });
    }
  }

  private createRoleFromQuery(): UserRole {
    const requestedRole = this.route.snapshot.queryParamMap.get('role')?.toLowerCase();
    return requestedRole === 'waiter' ? UserRole.Waiter : UserRole.Customer;
  }
}
