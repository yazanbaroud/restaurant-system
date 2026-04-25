import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { User, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { controlError } from '../../shared/form-validation';
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
        <p class="muted">
          התחברות מתבצעת מול שרת המסעדה ושומרת JWT בדפדפן לצורך גישה לממשקי צוות.
        </p>

        @if (requestedRoleLabel) {
          <div class="note">נדרשת התחברות עם הרשאת {{ requestedRoleLabel }}.</div>
        }
        @if (forbidden) {
          <div class="validation-note">למשתמש המחובר אין הרשאה למסך המבוקש.</div>
        }
        @if (errorMessage) {
          <div class="validation-note">{{ errorMessage }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <label class="full">
            אימייל
            <input type="email" formControlName="email" autocomplete="email" />
            @if (fieldError('email')) {
              <span class="field-error">{{ fieldError('email') }}</span>
            }
          </label>
          <label class="full">
            סיסמה
            <input type="password" formControlName="password" autocomplete="current-password" />
            @if (fieldError('password')) {
              <span class="field-error">{{ fieldError('password') }}</span>
            }
          </label>
          <button class="btn btn-gold full" type="submit" [disabled]="isSubmitting">
            {{ isSubmitting ? 'מתחברים...' : 'כניסה' }}
          </button>
        </form>

        <a class="text-link" routerLink="/register">פתיחת חשבון לקוח</a>
      </div>
    </section>
  `
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly roleLabels = roleLabels;
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  isSubmitting = false;
  errorMessage = '';
  submitted = false;

  get requestedRoleLabel(): string {
    const role = Number(this.route.snapshot.queryParamMap.get('role')) as UserRole;
    return roleLabels[role] ?? '';
  }

  get forbidden(): boolean {
    return this.route.snapshot.queryParamMap.get('forbidden') === 'true';
  }

  submit(): void {
    if (this.form.invalid) {
      this.submitted = true;
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.auth.login(this.form.getRawValue()).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: (user) => this.navigateAfterLogin(user),
      error: () => {
        this.errorMessage = 'ההתחברות נכשלה. בדקו אימייל וסיסמה ונסו שוב.';
      }
    });
  }

  private navigateAfterLogin(user: User): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const authorizedReturnUrl = this.getAuthorizedReturnUrl(user, returnUrl);

    void this.router.navigateByUrl(authorizedReturnUrl ?? this.getDefaultRouteForRole(user.role));
  }

  private getDefaultRouteForRole(role: UserRole): string {
    if (role === UserRole.Admin) {
      return '/admin';
    }

    if (role === UserRole.Waiter) {
      return '/waiter';
    }

    return '/';
  }

  private getAuthorizedReturnUrl(user: User, returnUrl: string | null): string | null {
    if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
      return null;
    }

    const path = returnUrl.split(/[?#]/)[0];
    if (user.role === UserRole.Admin) {
      return this.isRouteSection(path, '/admin') ? returnUrl : null;
    }

    if (user.role === UserRole.Waiter) {
      return this.isRouteSection(path, '/waiter') ? returnUrl : null;
    }

    return path === '/' || this.isRouteSection(path, '/menu') || this.isRouteSection(path, '/reservation')
      ? returnUrl
      : null;
  }

  private isRouteSection(path: string, section: string): boolean {
    return path === section || path.startsWith(`${section}/`);
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.submitted);
  }
}
