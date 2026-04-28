function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isTechnicalMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('http failure response') ||
    normalized.includes('unknown error') ||
    normalized.includes('networkerror') ||
    normalized.includes('syntaxerror') ||
    normalized.includes('typeerror') ||
    normalized.includes('exception') ||
    normalized.includes('stack trace');
}

function friendlyMessage(value: unknown): string {
  const message = textValue(value);
  return message && !isTechnicalMessage(message) ? message : '';
}

function validationErrorsMessage(value: unknown): string {
  const errors = asRecord(value);
  if (!errors) {
    return '';
  }

  for (const messages of Object.values(errors)) {
    if (Array.isArray(messages)) {
      const message = messages.map(friendlyMessage).find(Boolean);
      if (message) {
        return message;
      }
    }

    const message = friendlyMessage(messages);
    if (message) {
      return message;
    }
  }

  return '';
}

function payloadMessage(payload: unknown): string {
  const directMessage = friendlyMessage(payload);
  if (directMessage) {
    return directMessage;
  }

  const record = asRecord(payload);
  if (!record) {
    return '';
  }

  const validationMessage = validationErrorsMessage(record['errors']);
  if (validationMessage) {
    return validationMessage;
  }

  return friendlyMessage(record['message']) || friendlyMessage(record['title']) || friendlyMessage(record['detail']);
}

export const DEFAULT_API_ERROR_MESSAGE = 'אירעה שגיאה, נסה שוב';
export const DEFAULT_SUCCESS_MESSAGE = 'הפעולה בוצעה בהצלחה';

export function apiErrorMessage(error: unknown, fallback = DEFAULT_API_ERROR_MESSAGE): string {
  const record = asRecord(error);
  const nestedMessage = record ? payloadMessage(record['error']) : '';

  return nestedMessage || payloadMessage(error) || fallback;
}
