import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const israeliPhonePattern = /^(?:\+972|0)(?:[-\s]?\d){8,9}$/;

export const passwordPattern = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/
};

export function israeliPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) {
      return null;
    }

    return israeliPhonePattern.test(value) ? null : { phone: true };
  };
}

export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) {
      return null;
    }

    const errors: ValidationErrors = {};
    if (value.length < 8) {
      errors['minlength'] = { requiredLength: 8, actualLength: value.length };
    }
    if (!passwordPattern.uppercase.test(value)) {
      errors['uppercase'] = true;
    }
    if (!passwordPattern.lowercase.test(value)) {
      errors['lowercase'] = true;
    }
    if (!passwordPattern.number.test(value)) {
      errors['number'] = true;
    }

    return Object.keys(errors).length ? errors : null;
  };
}

export function controlError(control: AbstractControl | null | undefined, submitted = false): string {
  if (!control || (!submitted && !control.touched && !control.dirty)) {
    return '';
  }

  if (control.hasError('required')) {
    return 'שדה חובה';
  }
  if (control.hasError('email')) {
    return 'כתובת האימייל אינה תקינה';
  }
  if (control.hasError('phone')) {
    return 'מספר הטלפון אינו תקין';
  }
  if (control.hasError('min')) {
    return 'הערך נמוך מדי';
  }
  if (control.hasError('minlength')) {
    return 'הסיסמה חייבת להכיל לפחות 8 תווים';
  }
  if (control.hasError('uppercase')) {
    return 'הסיסמה חייבת להכיל אות גדולה באנגלית';
  }
  if (control.hasError('lowercase')) {
    return 'הסיסמה חייבת להכיל אות קטנה באנגלית';
  }
  if (control.hasError('number')) {
    return 'הסיסמה חייבת להכיל ספרה';
  }
  if (control.hasError('passwordMismatch')) {
    return 'אימות הסיסמה אינו תואם';
  }

  return '';
}
