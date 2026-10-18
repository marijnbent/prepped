import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChefHat, ChevronDown, CookingPot, CornerDownRight, Flame, Hourglass, Merge, RotateCw, Slice, Workflow } from "lucide-react";
import type { FlowRecipe, RecipeFlow as RecipeFlowGraph } from "@/lib/recipe-flow";
import { scaleAmount } from "@/lib/scale-amount";
import { formatStepDuration } from "@/lib/recipe-export";
import { t } from "@/lib/i18n";

type FlowNode = RecipeFlowGraph["nodes"][number];
type FlowKind = FlowNode["kind"];
type FlowIngredient = FlowRecipe["ingredients"][number];
type FlowStep = FlowRecipe["steps"][number];

export interface RecipeFlowLabels {
  title: string;
  subtitle: string;
  loading: string;
  loadingHint: string;
  error: string;
  staleError: string;
  busyError: string;
  unverifiedError: string;
  tooLargeError: string;
  retry: string;
  signIn: string;
  signInAction: string;
  layout: string;
  chart: string;
  list: string;
  step: string;
  beforeYouStart: string;
  goesIn: string;
  fromEarlier: string;
  total: string;
  forServings: string;
  scaledNote: string;
  fullStep: string;
  selectHint: string;
  asWritten: string;
  notInChart: string;
  notes: string;
  close: string;
  kindPrepare: string;
  kindCombine: string;
  kindHeat: string;
  kindRest: string;
  kindFinish: string;
  kindSetup: string;
}

const defaultLabels: RecipeFlowLabels = {
  title: "Cooking flow",
  subtitle: "See which ingredients go into each step",
  loading: "Putting the overview together…",
  loadingHint: "The first time can take a few seconds. The recipe below is ready to use.",
  error: "The overview couldn't be loaded.",
  staleError: "This recipe changed while the overview was being made. Reload the page to try again.",
  busyError: "The overview is still being made. Try again in a moment.",
  unverifiedError: "We couldn't make a reliable overview for this recipe. The steps below are unchanged.",
  tooLargeError: "This recipe is too long for an overview.",
  retry: "Try again",
  signIn: "Sign in to see which ingredients go into each step.",
  signInAction: "Sign in",
  layout: "Layout",
  chart: "Chart",
  list: "List",
  step: "Step {n}",
  beforeYouStart: "Preparation",
  goesIn: "Goes in",
  fromEarlier: "from “{label}”",
  total: "{amount} in total",
  forServings: "for {n}",
  scaledNote: "Amounts are for {servings} servings. Quoted step text stays as written for {original}.",
  fullStep: "Full step {n}",
  selectHint: "Select a step in the chart to read the full instruction.",
  asWritten: "Original serving count: {n}",
  notInChart: "Also in this recipe:",
  notes: "Good to know ({n})",
  close: "Close",
  kindPrepare: "Prep",
  kindCombine: "Combine",
  kindHeat: "Heat",
  kindRest: "Rest",
  kindFinish: "Finish",
  kindSetup: "Setup",
};

interface Props {
  recipeId: number;
  recipe: FlowRecipe;
  preferenceKey?: string;
  canGenerate: boolean;
  fingerprint: string;
  loginHref?: string;
  labels?: Partial<RecipeFlowLabels>;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; flow: RecipeFlowGraph }
  | { status: "signin" }
  | { status: "error"; message: string; retry: boolean };

type IngredientCell = {
  type: "ingredient";
  key: string;
  index: number;
  portion: string;
  showAmount: boolean;
  showTotal: boolean;
};
type ActionCell = { type: "action"; key: string; node: FlowNode; root: boolean };
type ReferenceCell = { type: "reference"; key: string; node: FlowNode; portion: string };
type PlacedCell = (IngredientCell | ActionCell | ReferenceCell) & { row: number; span: number; col: number; colEnd: number };

const STORAGE_KEY = "prepped:recipe-flow-open";
const TRIVIAL_PORTIONS = new Set(["", "all", "whole", "entire", "full", "everything", "alle", "alles", "heel", "hele", "geheel", "volledig", "allemaal"]);

const kindIcons: Record<FlowKind, typeof Flame> = {
  prepare: Slice,
  combine: Merge,
  heat: Flame,
  rest: Hourglass,
  finish: ChefHat,
  setup: CookingPot,
};

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

function isTrivialPortion(portion: string | undefined) {
  return TRIVIAL_PORTIONS.has((portion ?? "").trim().toLocaleLowerCase());
}

function ingredientIndex(ref: string, count: number) {
  if (!/^i\d+$/.test(ref)) return -1;
  const index = Number(ref.slice(1)) - 1;
  return index >= 0 && index < count ? index : -1;
}

function splitName(name: string) {
  const match = name.match(/^([^,(]+)([,(].*)$/);
  if (!match) return { primary: name, secondary: "" };
  return { primary: match[1].trim(), secondary: match[2].replace(/^,\s*/, "").trim() };
}

function storageKey(preferenceKey?: string) {
  return preferenceKey ? `${STORAGE_KEY}:${preferenceKey}` : STORAGE_KEY;
}

function readPreference(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writePreference(key: string, open: boolean) {
  try {
    if (open) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {}
}

async function readFailure(response: Response, labels: RecipeFlowLabels): Promise<{ message: string; retry: boolean } | "signin"> {
  if (response.status === 401) return "signin";
  let code = "";
  try {
    const body = await response.json();
    if (typeof body?.code === "string") code = body.code;
  } catch {}
  if (response.status === 409 || code === "RECIPE_CHANGED") return { message: labels.staleError, retry: false };
  if (code === "FLOW_BUSY" || code === "FLOW_RETRY_LATER" || response.status === 429) return { message: labels.busyError, retry: true };
  if (code === "FLOW_UNVERIFIED") return { message: labels.unverifiedError, retry: true };
  if (response.status === 422) return { message: labels.tooLargeError, retry: false };
  return { message: labels.error, retry: true };
}

function nodeInputs(node: FlowNode, ingredientCount: number) {
  const inputs = node.inputs.map((input) => ({ ref: input.ref, portion: input.portion ?? "" }));
  const direct = new Set(inputs.map((input) => ingredientIndex(input.ref, ingredientCount)).filter((index) => index >= 0));
  for (const id of node.ingredientIds ?? []) {
    const index = id - 1;
    if (index >= 0 && index < ingredientCount && !direct.has(index)) {
      direct.add(index);
      inputs.push({ ref: `i${id}`, portion: "" });
    }
  }
  return inputs;
}

function isWholeIngredient(portion: string, ingredient: FlowIngredient) {
  const normalized = portion.trim().toLocaleLowerCase();
  return isTrivialPortion(portion) || normalized === ingredient.name.trim().toLocaleLowerCase() || normalized === splitName(ingredient.name).primary.toLocaleLowerCase();
}

function buildModel(flow: RecipeFlowGraph, ingredients: FlowIngredient[]) {
  const ingredientCount = ingredients.length;
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  const inputsById = new Map(flow.nodes.map((node) => [node.id, nodeInputs(node, ingredientCount)]));
  const consumed = new Set<string>();
  for (const inputs of inputsById.values()) for (const input of inputs) if (nodes.has(input.ref)) consumed.add(input.ref);

  const setup = flow.nodes.filter((node) => node.kind === "setup" && !consumed.has(node.id) && (inputsById.get(node.id)?.length ?? 0) === 0);
  const setupIds = new Set(setup.map((node) => node.id));
  const roots = flow.nodes.filter((node) => !consumed.has(node.id) && !setupIds.has(node.id));

  const cells: (PlacedCell & { parent?: number })[] = [];
  const seen = new Set<string>();
  const usedIngredients = new Set<number>();
  for (const inputs of inputsById.values()) {
    for (const input of inputs) {
      const index = ingredientIndex(input.ref, ingredientCount);
      if (index >= 0) {
        usedIngredients.add(index);
      }
    }
  }
  const shown = new Set<number>();
  const owner = new Map<string, string>();
  for (const node of flow.nodes) for (const input of inputsById.get(node.id) ?? []) if (nodes.has(input.ref) && !owner.has(input.ref)) owner.set(input.ref, node.id);
  let row = 0;

  function visit(ref: string, portion: string, path: Set<string>, parentId?: string): number | null {
    const index = ingredientIndex(ref, ingredientCount);
    if (index >= 0) {
      const trivial = isWholeIngredient(portion, ingredients[index]);
      const first = !shown.has(index);
      shown.add(index);
      cells.push({
        type: "ingredient",
        key: `i-${row}`,
        index,
        portion: trivial ? "" : portion,
        showAmount: trivial && first,
        showTotal: !trivial && first,
        row: row++,
        span: 1,
        col: 0,
        colEnd: 1,
      });
      return 0;
    }
    const node = nodes.get(ref);
    if (!node) return null;
    if (seen.has(ref) || path.has(ref) || (owner.has(ref) && owner.get(ref) !== parentId)) {
      cells.push({ type: "reference", key: `r-${row}`, node, portion: isTrivialPortion(portion) ? "" : portion, row: row++, span: 1, col: 0, colEnd: 1 });
      return 0;
    }
    seen.add(ref);
    const start = row;
    const nextPath = new Set(path).add(ref);
    const childStart = cells.length;
    const depths: number[] = [];
    for (const input of inputsById.get(ref) ?? []) {
      const depth = visit(input.ref, input.portion, nextPath, ref);
      if (depth !== null) depths.push(depth);
    }
    const childIndexes: number[] = [];
    for (let i = childStart; i < cells.length; i++) if (cells[i].parent === undefined) childIndexes.push(i);
    if (depths.length === 0) row++;
    const depth = depths.length ? Math.max(...depths) + 1 : 0;
    const own = cells.length;
    cells.push({ type: "action", key: `n-${ref}`, node, root: false, row: start, span: row - start, col: depth, colEnd: depth + 1 });
    for (const child of childIndexes) {
      cells[child].parent = own;
      cells[child].colEnd = depth;
    }
    return depth;
  }

  for (const root of roots) visit(root.id, "", new Set());
  for (const node of flow.nodes) if (!seen.has(node.id) && !setupIds.has(node.id)) visit(node.id, "", new Set(), owner.get(node.id));

  const columns = cells.reduce((max, cell) => Math.max(max, cell.col + 1), 1);
  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i];
    if (cell.parent === undefined) {
      cell.colEnd = columns;
      if (cell.type === "action") {
        cell.root = true;
        cell.col = columns - 1;
      }
      continue;
    }
    cell.colEnd = cells[cell.parent].col;
    cell.col = cell.type === "action" ? cell.colEnd - 1 : 0;
  }

  const unused = Array.from({ length: ingredientCount }, (_, index) => index).filter((index) => !usedIngredients.has(index));
  const ordered = [...flow.nodes].map((node, order) => ({ node, order })).sort((a, b) => a.node.sourceStep - b.node.sourceStep || a.order - b.order).map(({ node }) => node);

  return { nodes, inputsById, setup, cells, rows: row, columns, unused, ordered };
}

function lineage(nodeId: string, inputsById: Map<string, { ref: string; portion: string }[]>) {
  const ids = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const input of inputsById.get(id) ?? []) stack.push(input.ref);
  }
  return ids;
}

function findStep(steps: FlowStep[], order: number): FlowStep | undefined {
  return steps.find((step) => step.order === order) ?? steps[order - 1];
}

function Excerpt({ text, excerpt }: { text: string; excerpt: string }) {
  const at = excerpt ? text.indexOf(excerpt) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[4px] bg-highlight px-0.5 text-highlight-foreground [box-decoration-break:clone]">{excerpt}</mark>
      {text.slice(at + excerpt.length)}
    </>
  );
}

export default function RecipeFlow({ recipeId, recipe, preferenceKey, canGenerate, fingerprint, loginHref, labels: labelOverrides }: Props) {
  const labels = useMemo(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides]);
  const baseId = useId().replace(/:/g, "");
  const key = storageKey(preferenceKey);
  const baseServings = recipe.servings || 4;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [servings, setServings] = useState(baseServings);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "list" | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ status: "loading" });
    const url = `/api/recipes/${recipeId}/flow?fingerprint=${encodeURIComponent(fingerprint)}`;
    try {
      const cached = await fetch(url, { headers: { Accept: "application/json" } });
      if (cached.ok) {
        const body = await cached.json();
        if (body?.status === "ready" && body.flow && body.fingerprint === fingerprint) {
          setState({ status: "ready", flow: body.flow });
          return;
        }
      } else if (cached.status !== 401 && cached.status !== 403) {
        const failure = await readFailure(cached, labels);
        setState(failure === "signin" ? { status: "signin" } : { status: "error", ...failure });
        return;
      }
      if (!canGenerate) {
        setState({ status: "signin" });
        return;
      }
      const generated = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fingerprint }),
      });
      if (!generated.ok) {
        const failure = await readFailure(generated, labels);
        setState(failure === "signin" ? { status: "signin" } : { status: "error", ...failure });
        return;
      }
      const body = await generated.json();
      if (body?.status !== "ready" || !body.flow) {
        setState({ status: "error", message: labels.error, retry: true });
        return;
      }
      if (body.fingerprint !== fingerprint) {
        setState({ status: "error", message: labels.staleError, retry: false });
        return;
      }
      setState({ status: "ready", flow: body.flow });
    } catch {
      setState({ status: "error", message: labels.error, retry: true });
    } finally {
      inFlight.current = false;
    }
  }, [recipeId, fingerprint, canGenerate, labels]);

  useEffect(() => {
    if (readPreference(key)) setOpen(true);
    const initial = Number(document.documentElement.dataset.recipeServings);
    if (Number.isFinite(initial) && initial > 0) setServings(initial);
    const onServings = (event: Event) => {
      const next = (event as CustomEvent<{ servings?: number }>).detail?.servings;
      if (typeof next === "number" && Number.isFinite(next) && next > 0) setServings(next);
    };
    window.addEventListener("prepped:servings-change", onServings);
    document.addEventListener("prepped:servings-change", onServings);
    return () => {
      window.removeEventListener("prepped:servings-change", onServings);
      document.removeEventListener("prepped:servings-change", onServings);
    };
  }, [key]);

  useEffect(() => {
    if (open && state.status === "idle") void load();
  }, [open, state.status, load]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    writePreference(key, next);
  };

  const flow = state.status === "ready" ? state.flow : null;
  const model = useMemo(() => (flow ? buildModel(flow, recipe.ingredients) : null), [flow, recipe.ingredients]);
  const factor = servings / baseServings;
  const scaled = factor !== 1;
  const hasChart = !!model && model.cells.length > 0;
  const activeView = view ?? "chart";
  const highlighted = useMemo(() => (selected && model ? lineage(selected, model.inputsById) : null), [selected, model]);
  const selectedNode = selected && model ? model.nodes.get(selected) ?? null : null;
  const regionId = `${baseId}-flow`;

  const kindLabel = (kind: FlowKind) =>
    ({ prepare: labels.kindPrepare, combine: labels.kindCombine, heat: labels.kindHeat, rest: labels.kindRest, finish: labels.kindFinish, setup: labels.kindSetup })[kind] ?? "";

  const amountText = (ingredient: FlowIngredient) => {
    if (!ingredient.amount) return "";
    const amount = scaleAmount(ingredient.amount, factor);
    return ingredient.unit ? `${amount} ${ingredient.unit}` : amount;
  };

  const portionText = (portion: string) => (
    <>
      {portion}
      {scaled && /\d/.test(portion) && <span className="text-muted-foreground"> ({fill(labels.forServings, { n: baseServings })})</span>}
    </>
  );

  const renderIngredient = (index: number, portion: string, showAmount: boolean, showTotal: boolean, compact = false) => {
    const ingredient = recipe.ingredients[index];
    if (!ingredient) return null;
    const { primary, secondary } = splitName(ingredient.name);
    const amount = amountText(ingredient);
    return (
      <span className="flex min-w-0 items-baseline gap-2">
        {portion ? (
          <span className="min-w-0 break-words rounded-[6px] border border-border px-[6px] text-sm font-medium">{portionText(portion)}</span>
        ) : showAmount && amount ? (
          <mark className="shrink-0 whitespace-nowrap rounded-[6px] bg-highlight px-[6px] text-sm font-medium tabular-nums text-highlight-foreground">{amount}</mark>
        ) : showAmount && !ingredient.amount ? (
          <span className="shrink-0 text-xs text-muted-foreground">{t("recipe.toTaste")}</span>
        ) : null}
        <span className="min-w-0 break-words">
          {primary}
          {!compact && secondary && <span className="block text-xs leading-snug text-muted-foreground">{secondary}</span>}
          {showTotal && amount && <span className="block text-xs leading-snug text-muted-foreground tabular-nums">{fill(labels.total, { amount })}</span>}
        </span>
      </span>
    );
  };

  const kindTag = (kind: FlowKind, inverted = false) => {
    const Icon = kindIcons[kind] ?? Merge;
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.06em] ${inverted ? "text-background/70" : "text-muted-foreground"}`}>
        <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        {kindLabel(kind)}
      </span>
    );
  };

  const dimmed = (id: string) => highlighted !== null && !highlighted.has(id);

  const renderChart = () => {
    if (!model) return null;
    const template = `minmax(160px, 1.2fr) repeat(${Math.max(model.columns - 1, 0)}, minmax(132px, 1fr))`;
    return (
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          role="group"
          aria-label={labels.title}
          className="grid gap-px overflow-hidden rounded-[20px] border border-border bg-border"
          style={{ gridTemplateColumns: template, gridAutoRows: "minmax(48px, auto)", minWidth: `${160 + 132 * (model.columns - 1)}px` }}
        >
          {model.cells.map((cell) => {
            const area = { gridRow: `${cell.row + 1} / span ${cell.span}`, gridColumn: `${cell.col + 1} / ${cell.colEnd + 1}` };
            if (cell.type === "ingredient") {
              const isDim = highlighted !== null && !highlighted.has(`i${cell.index + 1}`);
              return (
                <div key={cell.key} style={area} className={`flex items-center bg-background px-3.5 py-2.5 text-[15px] leading-snug transition-opacity ${isDim ? "opacity-40" : ""}`}>
                  {renderIngredient(cell.index, cell.portion, cell.showAmount, cell.showTotal)}
                </div>
              );
            }
            if (cell.type === "reference") {
              return (
                <button
                  key={cell.key}
                  type="button"
                  style={area}
                  onClick={() => setSelected(cell.node.id)}
                  className={`flex items-center gap-2 bg-background px-3.5 py-2.5 text-left text-[15px] leading-snug transition-opacity hover:bg-secondary ${dimmed(cell.node.id) ? "opacity-40" : ""}`}
                >
                  <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                  <span className="min-w-0">
                    {cell.portion ? portionText(cell.portion) : cell.node.label}
                    <span className="block text-xs text-muted-foreground">{cell.portion ? fill(labels.fromEarlier, { label: cell.node.label }) : fill(labels.step, { n: cell.node.sourceStep })}</span>
                  </span>
                </button>
              );
            }
            const node = cell.node;
            const isSelected = selected === node.id;
            const inverted = cell.root;
            return (
              <button
                key={cell.key}
                type="button"
                style={area}
                aria-pressed={isSelected}
                aria-controls={`${regionId}-source`}
                onClick={() => setSelected(isSelected ? null : node.id)}
                className={`group flex flex-col justify-start gap-1 px-3.5 py-3 text-left transition-[opacity,background-color] ${inverted ? "bg-foreground text-background hover:bg-foreground/90" : "bg-secondary hover:bg-[color-mix(in_srgb,var(--color-secondary)_80%,var(--color-foreground)_8%)]"} ${isSelected ? (inverted ? "shadow-[inset_0_0_0_3px_var(--color-highlight)]" : "shadow-[inset_0_0_0_2px_var(--color-foreground)]") : ""} ${dimmed(node.id) ? "opacity-40" : ""}`}
              >
                <span className="flex items-center justify-between gap-2">
                  {kindTag(node.kind, inverted)}
                  <span className={`shrink-0 whitespace-nowrap text-[11px] tabular-nums ${inverted ? "text-background/70" : "text-muted-foreground"}`}>{fill(labels.step, { n: node.sourceStep })}</span>
                </span>
                <span className="text-[15px] font-medium leading-snug">{node.label}</span>
                <span className={`text-[13px] leading-snug ${inverted ? "text-background/75" : "text-muted-foreground"}`}>{node.sourceText}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSource = () => {
    if (!selectedNode) return <p className="text-sm text-muted-foreground">{labels.selectHint}</p>;
    const step = findStep(recipe.steps, selectedNode.sourceStep);
    return (
      <div className="flex gap-4">
        <span className="w-8 shrink-0 text-3xl font-medium leading-none tabular-nums">{selectedNode.sourceStep}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{selectedNode.label}</span>
            {step?.duration ? <span className="text-sm text-muted-foreground">{fill(labels.fullStep, { n: selectedNode.sourceStep })}: ~{formatStepDuration(step.duration, t("recipe.minutes"), t("recipe.hours"))}</span> : null}
            {scaled && <span className="text-xs text-muted-foreground">{fill(labels.asWritten, { n: baseServings })}</span>}
          </div>
          <p className="max-w-[70ch] leading-[1.7]">{step ? <Excerpt text={step.instruction} excerpt={selectedNode.sourceText} /> : selectedNode.sourceText}</p>
        </div>
        <button type="button" onClick={() => setSelected(null)} className="h-8 shrink-0 self-start rounded-full px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
          {labels.close}
        </button>
      </div>
    );
  };

  const renderList = (variant: string) => {
    const listId = `${regionId}-${variant}`;
    if (!model) return null;
    return (
      <ol className="relative">
        {model.ordered.map((node, position) => {
          const inputs = model.inputsById.get(node.id) ?? [];
          const step = findStep(recipe.steps, node.sourceStep);
          const last = position === model.ordered.length - 1;
          const Icon = kindIcons[node.kind] ?? Merge;
          const seenBefore = new Set<number>();
          for (const earlier of model.ordered.slice(0, position)) for (const input of model.inputsById.get(earlier.id) ?? []) {
            const index = ingredientIndex(input.ref, recipe.ingredients.length);
            if (index >= 0) seenBefore.add(index);
          }
          return (
            <li key={node.id} id={`${listId}-${node.id}`} className="relative flex scroll-mt-24 gap-4 pb-7 last:pb-0">
              {!last && <span aria-hidden="true" className="absolute left-[15px] top-9 bottom-1 w-px bg-border" />}
              <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${node.kind === "finish" || last ? "bg-foreground text-background" : "bg-secondary"}`}>
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <h4 className="font-medium leading-snug">{node.label}</h4>
                  <span className="text-xs text-muted-foreground tabular-nums">{kindLabel(node.kind)} · {fill(labels.step, { n: node.sourceStep })}</span>
                </div>
                {inputs.length > 0 && (
                  <ul aria-label={labels.goesIn} className="mt-2.5 flex flex-wrap gap-1.5">
                    {inputs.map((input, i) => {
                      const index = ingredientIndex(input.ref, recipe.ingredients.length);
                      if (index >= 0) {
                        const trivial = isWholeIngredient(input.portion, recipe.ingredients[index]);
                        const first = !seenBefore.has(index);
                        seenBefore.add(index);
                        return (
                          <li key={i} className="rounded-full border border-border px-2.5 py-1 text-sm leading-snug">
                            {renderIngredient(index, trivial ? "" : input.portion, trivial && first, !trivial && first, true)}
                          </li>
                        );
                      }
                      const source = model.nodes.get(input.ref);
                      if (!source) return null;
                      return (
                        <li key={i}>
                          <a href={`#${listId}-${source.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-sm leading-snug hover:underline underline-offset-4">
                            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                            {isTrivialPortion(input.portion) ? source.label : portionText(input.portion)}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-2.5 max-w-[65ch] border-l-2 border-highlight pl-3 text-[15px] leading-relaxed">{node.sourceText}</p>
                {step && (step.instruction.trim() !== node.sourceText.trim() || step.duration || scaled) && (
                  <details className="group mt-2">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      {fill(labels.fullStep, { n: node.sourceStep })}
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden="true" />
                    </summary>
                    <div className="mt-2 max-w-[65ch] rounded-[14px] bg-secondary px-3.5 py-3 text-sm leading-relaxed">
                      <Excerpt text={step.instruction} excerpt={node.sourceText} />
                      {(step.duration || scaled) && (
                        <span className="mt-1.5 block text-xs text-muted-foreground">
                          {[step.duration ? `~${formatStepDuration(step.duration, t("recipe.minutes"), t("recipe.hours"))}` : "", scaled ? fill(labels.asWritten, { n: baseServings }) : ""].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  };

  const renderReady = () => {
    if (!model || !flow) return null;
    const showChart = activeView === "chart";
    const notes = flow.warnings.filter((warning) => warning.trim());
    const body: ReactNode = (
      <>
        <div className="hidden md:block">{showChart ? renderChart() : renderList("desktop")}</div>
        <div className="md:hidden">{renderList("mobile")}</div>
      </>
    );
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {scaled ? <p className="text-sm text-muted-foreground">{fill(labels.scaledNote, { servings, original: baseServings })}</p> : <span />}
          {hasChart && (
            <div role="group" aria-label={labels.layout} className="hidden items-center rounded-full border border-border p-1 md:inline-flex">
              {(["chart", "list"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={activeView === option}
                  onClick={() => setView(option)}
                  className={`h-8 rounded-full px-3.5 text-sm font-medium transition-colors ${activeView === option ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {option === "chart" ? labels.chart : labels.list}
                </button>
              ))}
            </div>
          )}
        </div>
        {showChart && model.setup.length > 0 && (
          <div className="hidden rounded-[20px] md:block border border-border px-4 py-3.5">
            <h4 className="mb-2 text-sm font-medium">{labels.beforeYouStart}</h4>
            <ul className="space-y-1.5">
              {model.setup.map((node) => (
                <li key={node.id} className="flex gap-3 text-[15px] leading-snug">
                  <CookingPot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                  <span className="min-w-0">
                    {node.sourceText}
                    <span className="ml-2 text-xs text-muted-foreground tabular-nums">{fill(labels.step, { n: node.sourceStep })}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {body}
        {showChart && (
          <div id={`${regionId}-source`} aria-live="polite" className={`hidden md:block ${selectedNode ? "sticky bottom-4 z-10 rounded-[20px] border border-border bg-background p-5" : "border-t border-border pt-5"}`}>
            {renderSource()}
          </div>
        )}
        {model.unused.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {labels.notInChart}{" "}
            {model.unused.map((index, i) => {
              const ingredient = recipe.ingredients[index];
              const amount = amountText(ingredient);
              return (
                <span key={index} className="text-foreground">
                  {i > 0 && ", "}
                  {amount && <span className="tabular-nums">{amount} </span>}
                  {ingredient.name}
                </span>
              );
            })}
          </p>
        )}
        {notes.length > 0 && (
          <details className="group rounded-[20px] bg-secondary px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {fill(labels.notes, { n: notes.length })}
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden="true" />
            </summary>
            <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
              {notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  };

  const renderBody = () => {
    if (state.status === "ready") return renderReady();
    if (state.status === "signin") {
      const href = loginHref ?? `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="text-sm text-muted-foreground">{labels.signIn}</p>
          <a href={href} className="inline-flex h-10 items-center rounded-full border-[1.5px] border-foreground px-[18px] text-sm font-medium hover:bg-secondary">
            {labels.signInAction}
          </a>
        </div>
      );
    }
    if (state.status === "error") {
      return (
        <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="text-sm">{state.message}</p>
          {state.retry && (
            <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-foreground px-[18px] text-sm font-medium hover:bg-secondary">
              <RotateCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {labels.retry}
            </button>
          )}
        </div>
      );
    }
    return (
      <div role="status" className="space-y-4">
        <div>
          <p className="text-sm font-medium">{labels.loading}</p>
          <p className="text-sm text-muted-foreground">{labels.loadingHint}</p>
        </div>
        <div aria-hidden="true" className="grid max-w-3xl grid-cols-[1.2fr_1fr_1fr] gap-px overflow-hidden rounded-[20px] border border-border bg-border">
          {[0, 1, 2].map((rowIndex) => (
            <div key={rowIndex} className="contents">
              <div className="h-12 motion-safe:animate-pulse bg-background" />
              {rowIndex === 0 && <div className="row-span-2 motion-safe:animate-pulse bg-secondary" />}
              {rowIndex === 0 && <div className="row-span-3 motion-safe:animate-pulse bg-secondary [animation-delay:150ms]" />}
              {rowIndex === 2 && <div className="motion-safe:animate-pulse bg-secondary" />}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="no-print mb-14 border-y border-border" aria-labelledby={`${regionId}-title`}>
      <h2 id={`${regionId}-title`} className="m-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={regionId}
          className="group flex w-full items-center gap-4 py-5 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
            <Workflow className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-medium tracking-tight">{labels.title}</span>
            {labels.subtitle && <span className="block text-sm text-muted-foreground">{labels.subtitle}</span>}
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border transition-colors group-hover:border-foreground">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
          </span>
        </button>
      </h2>
      {open && (
        <div id={regionId} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 pb-8 duration-200">
          {renderBody()}
        </div>
      )}
    </section>
  );
}
