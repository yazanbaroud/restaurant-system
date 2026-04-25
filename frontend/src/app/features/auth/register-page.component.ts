import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { controlError, israeliPhoneValidator, strongPasswordValidator } from '../../shared/form-validation';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-page" dir="rtl">
      <div class="auth-card">
        <p class="eyebrow">לקוח חדש</p>
        <h1>יצירת פרופיל להזמנות עתידיות</h1>
        <p class="muted">הרשמה מחוברת כעת לשרת ושומרת JWT אם השרת מחזיר טוקן.</p>

        @if (errorMessage) {
          <div class="validation-note">{{ errorMessage }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
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
            טלפון
            <input formControlName="phoneNumber" autocomplete="tel" />
            @if (fieldError('phoneNumber')) {
              <span class="field-error">{{ fieldError('phoneNumber') }}</span>
            }
          </label>
          <label>
            אימייל
            <input type="email" formControlName="email" autocomplete="email" />
            @if (fieldError('email')) {
              <span class="field-error">{{ fieldError('email') }}</span>
            }
          </label>
          <label class="full">
            סיסמה
            <input type="password" formControlName="password" autocomplete="new-password" />
            @if (fieldError('password')) {
              <span class="field-error">{{ fieldError('password') }}</span>
            }
          </label>
          <button class="btn btn-gold full" type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? 'שומר...' : 'הרשמה' }}
          </button>
        </form>
        <a class="text-link" routerLink="/login">כבר יש חשבון?</a>
      </div>
    </section>
  `
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, israeliPhoneValidator()]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, strongPasswordValidator()]]
  });

  isSubmitting = false;
  errorMessage = '';
  submitted = false;

  submit(): void {
    if (this.form.invalid) {
      this.submitted = true;
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.auth.register({
      ...this.form.getRawValue(),
      role: UserRole.Customer
    }).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: () => void this.router.navigateByUrl('/reservation'),
      error: () => {
        this.errorMessage = 'ההרשמה נכשלה. בדקו את הפרטים ונסו שוב.';
      }
    });
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.submitted);
  }
}
