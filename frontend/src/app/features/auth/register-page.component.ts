import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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
        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <label>
            שם פרטי
            <input formControlName="firstName" />
          </label>
          <label>
            שם משפחה
            <input formControlName="lastName" />
          </label>
          <label>
            טלפון
            <input formControlName="phoneNumber" />
          </label>
          <label>
            אימייל
            <input type="email" formControlName="email" />
          </label>
          <button class="btn btn-gold full" type="submit" [disabled]="form.invalid">הרשמה</button>
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
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    this.auth.registerCustomer(
      this.form.controls.firstName.value,
      this.form.controls.lastName.value,
      this.form.controls.email.value,
      this.form.controls.phoneNumber.value
    );
    void this.router.navigateByUrl('/reservation');
  }
}
