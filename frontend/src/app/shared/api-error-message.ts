function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validationErrorsMessage(value: unknown): string {
  const errors = asRecord(value);
  if (!errors) {
    return '';
  }

  for (const messages of Object.values(errors)) {
    if (Array.isArray(messages)) {
      const message = messages.map(textValue).find(Boolean);
      if (message) {
        return message;
      }
    }

    const message = textValue(messages);
    if (message) {
      return message;
    }
  }

  return '';
}

function payloadMessage(payload: unknown): string {
  const directMessage = textValue(payload);
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

  return textValue(record['message']) || textValue(record['title']) || textValue(record['detail']);
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const record = asRecord(error);
  const nestedMessage = record ? payloadMessage(record['error']) : '';

  return nestedMessage || payloadMessage(error) || fallback;
}
