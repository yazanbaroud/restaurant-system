import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { User, UserRole } from '../../core/models';
import { canUseReturnUrlForRole, defaultRouteForRole } from '../../core/guards/role-navigation';
import { AuthService } from '../../core/services/auth.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { apiErrorMessage } from '../../shared/api-error-message';
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
          התחברו כדי להמשיך להזמנות, לאזור האישי או לממשק הצוות המתאים לכם.
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
  private readonly feedback = inject(FeedbackService);
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
      this.feedback.error(null, 'מלאו אימייל וסיסמה תקינים.');
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.auth.login(this.form.getRawValue()).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: (user) => {
        this.feedback.success();
        this.navigateAfterLogin(user);
      },
      error: (error: unknown) => {
        this.errorMessage = apiErrorMessage(error, 'ההתחברות נכשלה. בדקו אימייל וסיסמה ונסו שוב.');
        this.feedback.error(error, this.errorMessage);
      }
    });
  }

  private navigateAfterLogin(user: User): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const authorizedReturnUrl = this.getAuthorizedReturnUrl(user, returnUrl);

    void this.router.navigateByUrl(authorizedReturnUrl ?? defaultRouteForRole(user.role));
  }

  private getAuthorizedReturnUrl(user: User, returnUrl: string | null): string | null {
    return canUseReturnUrlForRole(user.role, returnUrl) ? returnUrl : null;
  }

  fieldError(controlName: keyof typeof this.form.controls): string {
    return controlError(this.form.controls[controlName], this.submitted);
  }
}
