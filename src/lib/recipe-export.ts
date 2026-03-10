import { groupIngredientsCupboardLast } from "./ingredient-groups";
import { locale } from "./i18n";

interface RecipeIngredient {
  amount: string;
  unit: string;
  name: string;
  group?: string;
}

interface RecipeStep {
  order: number;
  instruction: string;
  duration?: number;
}

interface RecipeExportLabels {
  ingredients: string;
  steps: string;
  notes: string;
  minutes: string;
  hours: string;
  toTaste: string;
}

interface BuildRecipePlainTextOptions {
  title: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  notes?: string | null;
  labels: RecipeExportLabels;
}

export function groupRecipeIngredients(ingredients: RecipeIngredient[]) {
  return groupIngredientsCupboardLast(ingredients);
}

export function formatRecipeIngredientLine(ingredient: RecipeIngredient, toTasteLabel: string) {
  const amountPart = [ingredient.amount, ingredient.unit].filter(Boolean).join(" ").trim();

  if (!amountPart) {
    return `${ingredient.name} (${toTasteLabel})`;
  }

  return `${amountPart} ${ingredient.name}`.trim();
}

export function formatStepDuration(duration: number, minutesLabel: string, hoursLabel: string) {
  if (duration <= 60) {
    return `${duration} ${minutesLabel}`;
  }

  const hours = duration / 60;
  const formattedHours = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(hours);

  return `${formattedHours} ${hoursLabel}`;
}

export function formatRecipeStepLine(step: RecipeStep, minutesLabel: string, hoursLabel: string) {
  if (!step.duration) {
    return `${step.order}. ${step.instruction}`;
  }

  return `${step.order}. ${step.instruction} (${formatStepDuration(step.duration, minutesLabel, hoursLabel)})`;
}

export function buildRecipePlainText({
  title,
  ingredients,
  steps,
  notes,
  labels,
}: BuildRecipePlainTextOptions) {
  const lines: string[] = [title, "", labels.ingredients];

  for (const group of groupRecipeIngredients(ingredients)) {
    if (group.group) {
      lines.push(`${group.group}:`);
    }

    for (const ingredient of group.items) {
      lines.push(`- ${formatRecipeIngredientLine(ingredient, labels.toTaste)}`);
    }

    if (group.group) {
      lines.push("");
    }
  }

  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  lines.push("", labels.steps);

  for (const step of steps) {
    lines.push(formatRecipeStepLine(step, labels.minutes, labels.hours));
  }

  if (notes?.trim()) {
    lines.push("", labels.notes, notes.trim());
  }

  return lines.join("\n");
}
