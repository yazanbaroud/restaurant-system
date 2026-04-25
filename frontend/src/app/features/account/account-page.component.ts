import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { controlError, israeliPhoneValidator, strongPasswordValidator } from '../../shared/form-validation';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { roleLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [AsyncPipe, PageHeaderComponent, ReactiveFormsModule],
  template: `
    <section class="page-surface narrow-page" dir="rtl">
      <app-page-header
        eyebrow="אזור אישי"
        title="פרטי החשבון שלי"
        subtitle="עדכון פרטים בסיסיים ושינוי סיסמה בצורה מאובטחת."
      />

      @if (auth.currentUser$ | async; as user) {
        <article class="panel account-summary">
          <div>
            <span class="muted">אימייל</span>
            <strong>{{ user.email }}</strong>
          </div>
          <div>
            <span class="muted">תפקיד</span>
            <strong>{{ roleLabels[user.role] }}</strong>
          </div>
        </article>
      }

      <form class="panel form-grid" [formGroup]="profileForm" (ngSubmit)="submitProfile()">
        <h2 class="full">פרטים אישיים</h2>
        <label>
          שם פרטי
          <input formControlName="firstName" autocomplete="given-name" />
          @if (profileFieldError('firstName')) {
            <span class="field-error">{{ profileFieldError('firstName') }}</span>
          }
        </label>
        <label>
          שם משפחה
          <input formControlName="lastName" autocomplete="family-name" />
          @if (profileFieldError('lastName')) {
            <span class="field-error">{{ profileFieldError('lastName') }}</span>
          }
        </label>
        <label class="full">
          טלפון
          <input formControlName="phoneNumber" autocomplete="tel" />
          @if (profileFieldError('phoneNumber')) {
            <span class="field-error">{{ profileFieldError('phoneNumber') }}</span>
          }
        </label>
        @if (profileMessage) {
          <p class="success-note full">{{ profileMessage }}</p>
        }
        @if (profileErrorMessage) {
          <p class="validation-note full">{{ profileErrorMessage }}</p>
        }
        <button class="btn btn-gold full" type="submit" [disabled]="isProfileSubmitting">שמירה</button>
      </form>

      <form class="panel form-grid" [formGroup]="passwordForm" (ngSubmit)="submitPassword()">
        <h2 class="full">שינוי סיסמה</h2>
        <label class="full">
          סיסמה נוכחית
          <input type="password" formControlName="currentPassword" autocomplete="current-password" />
          @if (passwordFieldError('currentPassword')) {
            <span class="field-error">{{ passwordFieldError('currentPassword') }}</span>
          }
        </label>
        <label>
          סיסמה חדשה
          <input type="password" formControlName="newPassword" autocomplete="new-password" />
          @if (passwordFieldError('newPassword')) {
            <span class="field-error">{{ passwordFieldError('newPassword') }}</span>
          }
        </label>
        <label>
          אימות סיסמה
          <input type="password" formControlName="confirmPassword" autocomplete="new-password" />
          @if (passwordFieldError('confirmPassword')) {
            <span class="field-error">{{ passwordFieldError('confirmPassword') }}</span>
          }
        </label>
        @if (passwordMessage) {
          <p class="success-note full">{{ passwordMessage }}</p>
        }
        @if (passwordErrorMessage) {
          <p class="validation-note full">{{ passwordErrorMessage }}</p>
        }
        <button class="btn btn-gold full" type="submit" [disabled]="isPasswordSubmitting">שינוי סיסמה</button>
      </form>
    </section>
  `
})
export class AccountPageComponent {
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly roleLabels = roleLabels;
  readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, israeliPhoneValidator()]]
  });
  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, strongPasswordValidator()]],
    confirmPassword: ['', Validators.required]
  });

  profileSubmitted = false;
  passwordSubmitted = false;
  isProfileSubmitting = false;
  isPasswordSubmitting = false;
  profileMessage = '';
  profileErrorMessage = '';
  passwordMessage = '';
  passwordErrorMessage = '';

  constructor() {
    this.auth.currentUser$.subscribe((user) => {
      if (!user || this.profileForm.dirty) {
        return;
      }

      this.profileForm.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber
      });
    });
  }

  submitProfile(): void {
    this.profileSubmitted = true;
    if (this.profileForm.invalid || this.isProfileSubmitting) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isProfileSubmitting = true;
    this.profileMessage = '';
    this.profileErrorMessage = '';
    this.auth.updateProfile(this.profileForm.getRawValue()).pipe(
      finalize(() => {
        this.isProfileSubmitting = false;
      })
    ).subscribe({
      next: () => {
        this.profileForm.markAsPristine();
        this.profileMessage = 'הפרטים עודכנו בהצלחה.';
      },
      error: () => {
        this.profileErrorMessage = 'לא הצלחנו לעדכן את הפרטים.';
      }
    });
  }

  submitPassword(): void {
    this.passwordSubmitted = true;
    this.passwordForm.controls.confirmPassword.setErrors(null);
    if (this.passwordForm.controls.newPassword.value !== this.passwordForm.controls.confirmPassword.value) {
      this.passwordForm.controls.confirmPassword.setErrors({ passwordMismatch: true });
    }

    if (this.passwordForm.invalid || this.isPasswordSubmitting) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isPasswordSubmitting = true;
    this.passwordMessage = '';
    this.passwordErrorMessage = '';
    this.auth.changePassword({
      currentPassword: this.passwordForm.controls.currentPassword.value,
      newPassword: this.passwordForm.controls.newPassword.value
    }).pipe(
      finalize(() => {
        this.isPasswordSubmitting = false;
      })
    ).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.passwordSubmitted = false;
        this.passwordMessage = 'הסיסמה עודכנה בהצלחה';
      },
      error: () => {
        this.passwordErrorMessage = 'לא הצלחנו לעדכן את הסיסמה';
      }
    });
  }

  profileFieldError(controlName: keyof typeof this.profileForm.controls): string {
    return controlError(this.profileForm.controls[controlName], this.profileSubmitted);
  }

  passwordFieldError(controlName: keyof typeof this.passwordForm.controls): string {
    return controlError(this.passwordForm.controls[controlName], this.passwordSubmitted);
  }
}
