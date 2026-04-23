import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { roleLabels } from '../../shared/ui-labels';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-page" dir="rtl">
      <div class="auth-card">
        <p class="eyebrow">כניסה למערכת</p>
        <h1>ברוכים הבאים למסעדת הכבש</h1>
        <p class="muted">אב טיפוס בלבד: בחירת משתמש משנה role במצב mock.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <label class="full">
            אימייל
            <input type="email" formControlName="email" />
          </label>
          <button class="btn btn-gold full" type="submit">כניסה</button>
        </form>
        <div class="demo-users">
          @for (user of auth.users; track user.id) {
            <button type="button" class="btn btn-ghost" (click)="loginAs(user.email)">
              {{ roleLabels[user.role] }} · {{ user.firstName }}
            </button>
          }
        </div>
        <a class="text-link" routerLink="/register">פתיחת חשבון לקוח</a>
      </div>
    </section>
  `
})
export class LoginPageComponent {
  readonly auth = inject(AuthService);
  readonly roleLabels = roleLabels;
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['customer@hakeves.test', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    this.loginAs(this.form.controls.email.value);
  }

  loginAs(email: string): void {
    const requestedRole = Number(this.route.snapshot.queryParamMap.get('role')) as UserRole;

    if (requestedRole === UserRole.Admin || requestedRole === UserRole.Waiter) {
      this.auth.switchRole(requestedRole);
    } else {
      this.auth.loginAs(email);
    }

    const role = this.auth.currentUser.role;

    if (role === UserRole.Admin) {
      void this.router.navigateByUrl('/admin');
      return;
    }

    if (role === UserRole.Waiter) {
      void this.router.navigateByUrl('/waiter');
      return;
    }

    void this.router.navigateByUrl('/');
  }
}
