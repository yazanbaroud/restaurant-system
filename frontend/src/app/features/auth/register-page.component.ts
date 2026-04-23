import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';

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
          </label>
          <label>
            שם משפחה
            <input formControlName="lastName" autocomplete="family-name" />
          </label>
          <label>
            טלפון
            <input formControlName="phoneNumber" autocomplete="tel" />
          </label>
          <label>
            אימייל
            <input type="email" formControlName="email" autocomplete="email" />
          </label>
          <label class="full">
            סיסמה
            <input type="password" formControlName="password" autocomplete="new-password" />
          </label>
          <button class="btn btn-gold full" type="submit" [disabled]="form.invalid || isSubmitting">
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
    phoneNumber: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  isSubmitting = false;
  errorMessage = '';

  submit(): void {
    if (this.form.invalid) {
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
}
