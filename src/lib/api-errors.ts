import { locale, t } from "@/lib/i18n";

type FlattenedFieldErrors = Record<string, string[] | undefined>;
type ValidationIssuePath = Array<string | number>;

type ValidationIssue = {
  code?: string;
  message?: string;
  path?: ValidationIssuePath;
  minimum?: number;
  format?: string;
};

type ErrorPayload = {
  error?: unknown;
  issues?: ValidationIssue[];
};

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

function isValidationIssue(value: unknown): value is ValidationIssue {
  return !!value && typeof value === "object";
}

function formatFieldLabel(path: ValidationIssuePath) {
  const [field, index, nested] = path;

  if (field === "steps" && typeof index === "number") {
    if (nested === "duration") return `${t("form.step")} ${index + 1} - ${t("form.durationMin")}`;
    if (nested === "instruction") return `${t("form.step")} ${index + 1}`;
    return `${t("recipe.steps")} ${index + 1}`;
  }

  if (field === "ingredients" && typeof index === "number") {
    if (nested === "name") return `${t("recipe.ingredients")} ${index + 1}`;
    return `${t("recipe.ingredients")} ${index + 1}`;
  }

  if (field === "title") return t("recipe.title");
  if (field === "description") return t("recipe.description");
  if (field === "servings") return t("recipe.servings");
  if (field === "prepTime") return t("recipe.prepTime");
  if (field === "cookTime") return t("recipe.cookTime");
  if (field === "difficulty") return t("recipe.difficulty");
  if (field === "sourceUrl") return t("recipe.sourceUrl");
  if (field === "videoUrl") return t("form.videoUrl");
  if (field === "notes") return t("recipe.notes");
  if (field === "imageUrl" || field === "imageProvider") return t("recipe.image");

  return undefined;
}

function formatValidationIssue(issue: ValidationIssue) {
  const label = Array.isArray(issue.path) ? formatFieldLabel(issue.path) : undefined;

  if (issue.code === "too_small" && issue.minimum === 0) {
    const message = locale === "nl" ? "moet groter zijn dan 0" : "must be greater than 0";
    return label ? `${label}: ${message}` : message;
  }

  if (issue.code === "invalid_format" && issue.format === "url") {
    const message = locale === "nl" ? "voer een geldige URL in" : "enter a valid URL";
    return label ? `${label}: ${message}` : message;
  }

  if (label && issue.message?.trim()) return `${label}: ${issue.message}`;
  if (issue.message?.trim()) return issue.message;
  return undefined;
}

export function getApiErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "issues" in payload && Array.isArray(payload.issues)) {
    const firstIssue = payload.issues.find(isValidationIssue);
    const formattedIssue = firstIssue ? formatValidationIssue(firstIssue) : undefined;
    if (formattedIssue) return formattedIssue;
  }

  const error = payload && typeof payload === "object" && "error" in payload ? payload.error : payload;

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
