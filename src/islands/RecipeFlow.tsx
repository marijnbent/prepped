import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, RotateCw } from "lucide-react";
import type { FlowRecipe, RecipeFlow as RecipeFlowGraph } from "@/lib/recipe-flow";
import { scaleAmount } from "@/lib/scale-amount";
import { formatStepDuration } from "@/lib/recipe-export";
import { t } from "@/lib/i18n";

interface Props {
  recipeId: number;
  recipe: FlowRecipe;
  preferenceKey?: string;
  canGenerate: boolean;
  fingerprint: string;
}

type LoadState =
  | { status: "idle" | "loading" | "signin" }
  | { status: "ready"; flow: RecipeFlowGraph }
  | { status: "error"; message: string; retry: boolean };

type FlowNode = RecipeFlowGraph["nodes"][number];
type Cell = { key: string; row: number; span: number; col: number; width: number; until?: number } & (
  | { type: "ingredient"; index: number; portion: string; showAmount: boolean; showTotal: boolean }
  | { type: "reference"; node: FlowNode; portion: string }
  | { type: "action"; node: FlowNode; portion: string; final: boolean }
  | { type: "empty" }
);

const TRIVIAL_PORTIONS = new Set(["", "all", "whole", "entire", "full", "everything", "alle", "alles", "heel", "hele", "geheel", "volledig", "allemaal"]);

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

function isTrivial(portion: string) {
  return TRIVIAL_PORTIONS.has(portion.trim().toLocaleLowerCase());
}

function isWhole(portion: string, name: string) {
  const value = portion.trim().toLocaleLowerCase();
  const full = name.trim().toLocaleLowerCase();
  return isTrivial(portion) || value === full || value === full.split(/[,(]/)[0].trim();
}

function buildMatrix(flow: RecipeFlowGraph, ingredients: FlowRecipe["ingredients"]) {
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  const consumed = new Set(flow.nodes.flatMap((node) => node.inputs.map((input) => input.ref)));
  const owner = new Map<string, string>();
  for (const node of flow.nodes) for (const { ref } of node.inputs) if (nodes.has(ref) && !owner.has(ref)) owner.set(ref, node.id);
  const inputsOf = (node: FlowNode) => {
    const inputs = node.inputs.map(({ ref, portion }) => ({ ref, portion: portion ?? "" }));
    for (const id of node.ingredientIds ?? []) if (!inputs.some((input) => input.ref === `i${id}`)) inputs.push({ ref: `i${id}`, portion: "" });
    return inputs;
  };
  const standaloneSetup = flow.nodes.filter((node) => node.kind === "setup" && !consumed.has(node.id) && inputsOf(node).length === 0);
  const firstFoodStep = flow.nodes.find((node) => node.kind !== "setup")?.sourceStep ?? Infinity;
  const setup = standaloneSetup.filter((node) => node.sourceStep <= firstFoodStep);
  const laterSetup = new Map<string, FlowNode[]>();
  for (const node of standaloneSetup.filter((node) => !setup.includes(node))) {
    const next = flow.nodes.find((candidate) => candidate.kind !== "setup" && candidate.sourceStep >= node.sourceStep && flow.nodes.indexOf(candidate) > flow.nodes.indexOf(node));
    if (next) {
      laterSetup.set(next.id, [...laterSetup.get(next.id) ?? [], node]);
      consumed.add(node.id);
      owner.set(node.id, next.id);
    }
  }

  const cells: Cell[] = [];
  const seen = new Set<string>();
  const shown = new Set<number>();
  let row = 0;
  const place = (cell: Cell) => (cells.push(cell), cell);

  function visit(ref: string, portion: string, parentId?: string): Cell | null {
    const index = /^i\d+$/.test(ref) ? Number(ref.slice(1)) - 1 : -1;
    const ingredient = ingredients[index];
    if (ingredient) {
      const whole = isWhole(portion, ingredient.name);
      const first = !shown.has(index);
      shown.add(index);
      return place({ type: "ingredient", key: `i-${row}`, index, portion: whole ? "" : portion, showAmount: whole && first, showTotal: !whole && first, row: row++, span: 1, col: 0, width: 1 });
    }
    const node = nodes.get(ref);
    if (!node) return null;
    if (seen.has(ref) || owner.get(ref) !== parentId) {
      return place({ type: "reference", key: `r-${row}`, node, portion: isTrivial(portion) ? "" : portion, row: row++, span: 1, col: 0, width: 1 });
    }
    seen.add(ref);
    const start = row;
    const inputs = [...inputsOf(node), ...(laterSetup.get(node.id) ?? []).map((setup) => ({ ref: setup.id, portion: "" }))];
    const children = inputs.map((input) => visit(input.ref, input.portion, ref)).filter((cell) => cell !== null);
    if (children.length === 0) row++;
    const col = Math.max(-1, ...children.map((child) => child.col)) + 1;
    for (const child of children) child.until = col;
    return place({ type: "action", key: `n-${ref}`, node, portion: isTrivial(portion) ? "" : portion, final: false, row: start, span: row - start, col, width: 1 });
  }

  for (const node of flow.nodes) if (!consumed.has(node.id) && !setup.includes(node)) visit(node.id, "");
  for (const node of flow.nodes) if (!seen.has(node.id) && !setup.includes(node)) visit(node.id, "", owner.get(node.id));

  const columns = Math.max(0, ...cells.map((cell) => cell.col)) + 1;
  for (const cell of [...cells]) {
    const end = cell.until ?? columns;
    if (cell.type === "action" && cell.until === undefined) cell.final = true;
    if (end > cell.col + 1) cells.push({ type: "empty", key: `e-${cell.key}`, row: cell.row, span: cell.span, col: cell.col + 1, width: end - cell.col - 1 });
  }
  return { setup, cells, columns };
}

function preferenceStorageKey(preferenceKey?: string) {
  return preferenceKey ? `prepped:recipe-flow-open:${preferenceKey}` : "prepped:recipe-flow-open";
}

async function readFailure(response: Response): Promise<LoadState> {
  if (response.status === 401) return { status: "signin" };
  const code = await response.json().then((body) => (typeof body?.code === "string" ? body.code : ""), () => "");
  if (response.status === 409 || code === "RECIPE_CHANGED") return { status: "error", message: t("recipeFlow.staleError"), retry: false };
  if (code === "FLOW_BUSY" || code === "FLOW_RETRY_LATER" || response.status === 429) return { status: "error", message: t("recipeFlow.busyError"), retry: true };
  if (code === "FLOW_UNVERIFIED") return { status: "error", message: t("recipeFlow.unverifiedError"), retry: true };
  if (response.status === 422) return { status: "error", message: t("recipeFlow.tooLargeError"), retry: false };
  return { status: "error", message: t("recipeFlow.error"), retry: true };
}

export default function RecipeFlow({ recipeId, recipe, preferenceKey, canGenerate, fingerprint }: Props) {
  const regionId = `${useId().replace(/[^\w-]/g, "")}-flow`;
  const storageKey = preferenceStorageKey(preferenceKey);
  const baseServings = recipe.servings || 4;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [servings, setServings] = useState(baseServings);
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
        if (body?.status === "ready" && body.flow && body.fingerprint === fingerprint) return setState({ status: "ready", flow: body.flow });
      } else if (cached.status !== 401 && cached.status !== 403) {
        return setState(await readFailure(cached));
      }
      if (!canGenerate) return setState({ status: "signin" });
      const generated = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fingerprint }),
      });
      if (!generated.ok) return setState(await readFailure(generated));
      const body = await generated.json();
      if (body?.status !== "ready" || !body.flow) setState({ status: "error", message: t("recipeFlow.error"), retry: true });
      else if (body.fingerprint !== fingerprint) setState({ status: "error", message: t("recipeFlow.staleError"), retry: false });
      else setState({ status: "ready", flow: body.flow });
    } catch {
      setState({ status: "error", message: t("recipeFlow.error"), retry: true });
    } finally {
      inFlight.current = false;
    }
  }, [recipeId, fingerprint, canGenerate]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === "1") setOpen(true);
    } catch {}
    const initial = Number(document.documentElement.dataset.recipeServings);
    if (Number.isFinite(initial) && initial > 0) setServings(initial);
    const onServings = (event: Event) => {
      const next = (event as CustomEvent<{ servings?: number }>).detail?.servings;
      if (typeof next === "number" && Number.isFinite(next) && next > 0) setServings(next);
    };
    window.addEventListener("prepped:servings-change", onServings);
    return () => window.removeEventListener("prepped:servings-change", onServings);
  }, [storageKey]);

  useEffect(() => {
    if (open && state.status === "idle") void load();
  }, [open, state.status, load]);

  const toggle = () => {
    setOpen(!open);
    try {
      if (open) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, "1");
    } catch {}
  };

  const flow = state.status === "ready" ? state.flow : null;
  const matrix = useMemo(() => (flow ? buildMatrix(flow, recipe.ingredients) : null), [flow, recipe.ingredients]);
  const factor = servings / baseServings;
  const offset = matrix?.setup.length ?? 0;

  const portionText = (portion: string) =>
    factor !== 1 && /\d/.test(portion) ? `${portion} (${fill(t("recipeFlow.forServings"), { n: baseServings })})` : portion;

  const renderAction = (node: FlowNode, style: CSSProperties, { final = false, portion = "", fullWidth = false } = {}) => {
    const duration = recipe.steps.find((step) => step.order === node.sourceStep)?.duration;
    return (
      <div key={node.id} id={`${regionId}-${node.id}`} tabIndex={-1} style={style} className={`flex min-w-0 scroll-mt-24 items-center ${fullWidth ? "justify-start" : "justify-center"} ${final ? "bg-highlight/20" : "bg-secondary/40"} px-2 py-1 text-center outline-none target:bg-highlight/40 focus-visible:bg-highlight/40`}>
        <details className={fullWidth ? "sticky left-0 w-[calc(100cqw-1.25rem)] max-w-full" : "min-w-0 max-w-full"}>
          <summary className="flex min-h-6 cursor-pointer list-none flex-col justify-center rounded-sm leading-snug hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground [&::-webkit-details-marker]:hidden">
            <span className={final ? "font-semibold" : "font-medium"}>{node.kind === "setup" ? node.sourceText : node.label}</span>
            {portion && <span className="block text-xs text-muted-foreground">{portionText(portion)}</span>}
          </summary>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-left text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{fill(t("recipeFlow.step"), { n: node.sourceStep })}</span> {node.kind !== "setup" && node.sourceText}
            {duration ? <span className="mt-1 block">{fill(t("recipeFlow.fullStep"), { n: node.sourceStep })}: ~{formatStepDuration(duration, t("recipe.minutes"), t("recipe.hours"))}</span> : null}
          </p>
        </details>
      </div>
    );
  };

  const renderCell = (cell: Cell) => {
    const style = { gridRow: `${cell.row + offset + 1} / span ${cell.span}`, gridColumn: `${cell.col + 1} / span ${cell.width}` };
    if (cell.type === "action") return renderAction(cell.node, style, cell);
    if (cell.type === "empty") return <div key={cell.key} style={style} aria-hidden="true" className="bg-background" />;
    if (cell.type === "reference") {
      const source = fill(t("recipeFlow.fromEarlier"), { label: cell.node.label });
      return (
        <div key={cell.key} style={style} className="flex min-w-0 items-center bg-background px-2.5 py-1.5 leading-snug">
          <a href={`#${regionId}-${cell.node.id}`} title={source} aria-label={cell.portion ? `${portionText(cell.portion)} ${source}` : source} className="min-w-0 underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 hover:decoration-foreground">
            {cell.portion ? portionText(cell.portion) : source}
          </a>
        </div>
      );
    }
    const ingredient = recipe.ingredients[cell.index];
    const amount = ingredient.amount ? `${scaleAmount(ingredient.amount, factor)}${ingredient.unit ? ` ${ingredient.unit}` : ""}` : "";
    return (
      <div key={cell.key} style={style} className="flex min-w-0 items-center bg-background px-2.5 py-1.5 leading-snug">
        <span className="min-w-0">
          {cell.showAmount && amount && <span className="font-medium tabular-nums">{amount} </span>}
          {cell.portion && <span className="font-medium">{portionText(cell.portion)} </span>}
          {ingredient.name}
          {cell.showTotal && amount && <span className="block text-xs text-muted-foreground tabular-nums">{fill(t("recipeFlow.total"), { amount })}</span>}
        </span>
      </div>
    );
  };

  const renderBody = () => {
    if (matrix) {
      const { setup, cells, columns } = matrix;
      return (
        <div className="@container overflow-x-auto pb-1" tabIndex={0} role="region" aria-label={t("recipeFlow.title")}>
          <div
            role="group"
            aria-label={t("recipeFlow.title")}
            className="grid gap-px overflow-clip rounded-md border border-border bg-background text-sm [overflow-wrap:anywhere] [&>div]:ring-1 [&>div]:ring-border"
            style={{
              gridTemplateColumns: `12rem repeat(${columns - 1}, minmax(0, 1fr))`,
              gridAutoRows: "minmax(2rem, auto)",
              width: `calc(${12 + 7 * (columns - 1)}rem + ${columns + 1}px)`,
            }}
          >
            {setup.map((node, index) => renderAction(node, { gridRow: index + 1, gridColumn: "1 / -1" }, { fullWidth: true }))}
            {cells.map(renderCell)}
          </div>
        </div>
      );
    }
    if (state.status === "signin") {
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="text-sm text-muted-foreground">{t("recipeFlow.signIn")}</p>
          <a href={`/login?redirect=${encodeURIComponent(window.location.pathname)}`} className="inline-flex h-10 items-center rounded-full border-[1.5px] border-foreground px-[18px] text-sm font-medium hover:bg-secondary">
            {t("recipeFlow.signInAction")}
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
              {t("recipeFlow.retry")}
            </button>
          )}
        </div>
      );
    }
    return (
      <div role="status" className="space-y-4">
        <p className="text-sm">
          <span className="block font-medium">{t("recipeFlow.loading")}</span>
          <span className="text-muted-foreground">{t("recipeFlow.loadingHint")}</span>
        </p>
        <div aria-hidden="true" className="max-w-2xl space-y-2">
          {["w-3/4", "w-1/2", "w-2/3"].map((width) => (
            <div key={width} className={`h-9 rounded-full bg-secondary motion-safe:animate-pulse ${width}`} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="no-print mb-10 border-y border-border" aria-labelledby={`${regionId}-title`}>
      <h2 id={`${regionId}-title`} className="m-0">
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={regionId} className="group flex w-full items-center justify-between gap-4 py-3 text-left">
          <span className="text-xl font-medium tracking-tight">{t("recipeFlow.title")}</span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border transition-colors group-hover:border-foreground">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
          </span>
        </button>
      </h2>
      {open && (
        <div id={regionId} className="pb-5">
          {flow && factor !== 1 && <p className="mb-3 text-sm text-muted-foreground">{fill(t("recipeFlow.scaledNote"), { servings, original: baseServings })}</p>}
          {renderBody()}
          {flow?.warnings.map((warning, index) => <p key={index} className="mt-3 text-sm text-muted-foreground">{warning}</p>)}
        </div>
      )}
    </section>
  );
}
