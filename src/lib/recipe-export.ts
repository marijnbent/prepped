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
  const groups: { group: string; items: RecipeIngredient[] }[] = [];
  const indexByGroup = new Map<string, number>();

  for (const ingredient of ingredients) {
    const group = ingredient.group || "";
    const existingIndex = indexByGroup.get(group);

    if (existingIndex === undefined) {
      indexByGroup.set(group, groups.length);
      groups.push({ group, items: [ingredient] });
      continue;
    }

    groups[existingIndex].items.push(ingredient);
  }

  return groups;
}

export function formatRecipeIngredientLine(ingredient: RecipeIngredient, toTasteLabel: string) {
  const amountPart = [ingredient.amount, ingredient.unit].filter(Boolean).join(" ").trim();

  if (!amountPart) {
    return `${ingredient.name} (${toTasteLabel})`;
  }

  return `${amountPart} ${ingredient.name}`.trim();
}

export function formatRecipeStepLine(step: RecipeStep, minutesLabel: string) {
  if (!step.duration) {
    return `${step.order}. ${step.instruction}`;
  }

  return `${step.order}. ${step.instruction} (${step.duration} ${minutesLabel})`;
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
    lines.push(formatRecipeStepLine(step, labels.minutes));
  }

  if (notes?.trim()) {
    lines.push("", labels.notes, notes.trim());
  }

  return lines.join("\n");
}
