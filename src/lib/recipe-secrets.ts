export interface SecretRecipeIngredient {
  amount: string;
  unit: string;
  name: string;
  group?: string;
}

export interface SecretRecipeStep {
  order: number;
  instruction: string;
  duration?: number;
}

const DIRK_SECRET_INGREDIENT: SecretRecipeIngredient = {
  amount: "1",
  unit: "",
  name: "schepje liefde",
};

const DIRK_SECRET_STEP_INSTRUCTION = "En eet smakelijk schatje. Je hebt iets heerlijks gemaakt!";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function applyDirkSecretIngredients<T extends SecretRecipeIngredient>(ingredients: T[], enabled: boolean) {
  if (!enabled) {
    return ingredients;
  }

  const hasLoveIngredient = ingredients.some((ingredient) =>
    normalizeText(`${ingredient.amount} ${ingredient.unit} ${ingredient.name}`) ===
      normalizeText(`${DIRK_SECRET_INGREDIENT.amount} ${DIRK_SECRET_INGREDIENT.unit} ${DIRK_SECRET_INGREDIENT.name}`)
  );

  if (hasLoveIngredient) {
    return ingredients;
  }

  return [...ingredients, DIRK_SECRET_INGREDIENT as T];
}

export function applyDirkSecretSteps<T extends SecretRecipeStep>(steps: T[], enabled: boolean) {
  if (!enabled) {
    return steps;
  }

  const hasSecretStep = steps.some((step) => normalizeText(step.instruction) === normalizeText(DIRK_SECRET_STEP_INSTRUCTION));
  if (hasSecretStep) {
    return steps;
  }

  const nextOrder = steps.reduce((maxOrder, step) => Math.max(maxOrder, step.order), 0) + 1;

  return [
    ...steps,
    {
      order: nextOrder,
      instruction: DIRK_SECRET_STEP_INSTRUCTION,
    } as T,
  ];
}

export function applyDirkSecretRecipeMode<
  TIngredient extends SecretRecipeIngredient,
  TStep extends SecretRecipeStep,
>({
  ingredients,
  steps,
  enabled,
}: {
  ingredients: TIngredient[];
  steps: TStep[];
  enabled: boolean;
}) {
  return {
    ingredients: applyDirkSecretIngredients(ingredients, enabled),
    steps: applyDirkSecretSteps(steps, enabled),
  };
}
