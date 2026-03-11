type FlattenedFieldErrors = Record<string, string[] | undefined>;

function firstNonEmpty(values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim());
}

function fromFlattenedError(error: { formErrors?: string[]; fieldErrors?: FlattenedFieldErrors }) {
  const formError = firstNonEmpty(error.formErrors || []);
  if (formError) return formError;

  for (const messages of Object.values(error.fieldErrors || {})) {
    const fieldError = firstNonEmpty(messages || []);
    if (fieldError) return fieldError;
  }

  return undefined;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error;

  if (error instanceof Error && error.message.trim()) return error.message;

  if (error && typeof error === "object") {
    const maybeMessage = "message" in error ? error.message : undefined;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;

    const flattened = fromFlattenedError(error as { formErrors?: string[]; fieldErrors?: FlattenedFieldErrors });
    if (flattened) return flattened;
  }

  return fallback;
}
