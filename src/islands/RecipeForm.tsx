import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Clock, Layers, Loader2, Search, Check } from "lucide-react";
import ImageUpload from "./ImageUpload";
import { t } from "@/lib/i18n";
import { getApiErrorMessage } from "@/lib/api-errors";
import { normalizeImageProvider } from "@/lib/image-provider";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Ingredient {
  amount: string;
  unit: string;
  name: string;
  group?: string;
}

type IngredientWithId = Ingredient & { _dndId: string };
let nextId = 0;
function withDndId(ing: Ingredient): IngredientWithId {
  return { ...ing, _dndId: `ing-${++nextId}` };
}

interface Step {
  order: number;
  instruction: string;
  duration?: number;
}

type StepWithId = Step & { _dndId: string };
function withStepDndId(step: Step): StepWithId {
  return { ...step, _dndId: `step-${++nextId}` };
}

interface RecipeData {
  id?: number;
  title: string;
  description?: string;
  ingredients: Ingredient[];
  steps: Step[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  difficulty?: "easy" | "medium" | "hard";
  imageUrl?: string;
  imageProvider?: "upload" | "unsplash";
  imageAuthorName?: string;
  imageAuthorUrl?: string;
  imageSourceUrl?: string;
  sourceUrl?: string;
  videoUrl?: string;
  notes?: string;
  tagIds?: number[];
  collectionIds?: number[];
}

interface UnsplashPhotoResult {
  id: string;
  alt: string;
  smallUrl: string;
  regularUrl: string;
  authorName: string;
  authorUrl: string;
  photoUrl: string;
  downloadLocation: string;
}

interface Props {
  initial?: RecipeData;
  tags?: { id: number; name: string }[];
  collections?: { id: number; name: string }[];
}

type NumericInputValue = number | "";

const emptyIngredient: Ingredient = { amount: "", unit: "", name: "" };
const emptyStep = (order: number): Step => ({ order, instruction: "" });

function parseNumericInput(value: string): NumericInputValue {
  return value === "" ? "" : Number(value);
}

function toOptionalPositiveNumber(value: NumericInputValue) {
  return typeof value === "number" && value > 0 ? value : undefined;
}

function IngredientRowFields({
  ing,
  index,
  onUpdate,
  onRemove,
  disableRemove,
  showGroup,
  dragHandleProps,
}: {
  ing: IngredientWithId;
  index: number;
  onUpdate: (index: number, field: keyof Ingredient, value: string) => void;
  onRemove: (index: number) => void;
  disableRemove: boolean;
  showGroup: boolean;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <>
      <div className="flex items-center gap-2 min-w-0 sm:flex-1">
        <button
          type="button"
          className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          placeholder={t("form.amount")}
          value={ing.amount}
          onChange={(e) => onUpdate(index, "amount", e.target.value)}
          className="w-20"
        />
        <Input
          placeholder={t("form.unit")}
          value={ing.unit}
          onChange={(e) => onUpdate(index, "unit", e.target.value)}
          className="w-20"
        />
        <Input
          placeholder={t("form.ingredientName")}
          value={ing.name}
          onChange={(e) => onUpdate(index, "name", e.target.value)}
          className="flex-1 min-w-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={disableRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {showGroup && (
        <Input
          placeholder={t("form.group")}
          value={ing.group || ""}
          onChange={(e) => onUpdate(index, "group", e.target.value)}
          className="w-full sm:w-28"
        />
      )}
    </>
  );
}

function SortableIngredientRow({
  ing,
  index,
  onUpdate,
  onRemove,
  disableRemove,
  showGroup,
}: {
  ing: IngredientWithId;
  index: number;
  onUpdate: (index: number, field: keyof Ingredient, value: string) => void;
  onRemove: (index: number) => void;
  disableRemove: boolean;
  showGroup: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ing._dndId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
      <IngredientRowFields
        ing={ing}
        index={index}
        onUpdate={onUpdate}
        onRemove={onRemove}
        disableRemove={disableRemove}
        showGroup={showGroup}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function StaticIngredientRow({
  ing,
  index,
  onUpdate,
  onRemove,
  disableRemove,
  showGroup,
}: {
  ing: IngredientWithId;
  index: number;
  onUpdate: (index: number, field: keyof Ingredient, value: string) => void;
  onRemove: (index: number) => void;
  disableRemove: boolean;
  showGroup: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
      <IngredientRowFields
        ing={ing}
        index={index}
        onUpdate={onUpdate}
        onRemove={onRemove}
        disableRemove={disableRemove}
        showGroup={showGroup}
        dragHandleProps={{ "aria-hidden": true, tabIndex: -1 }}
      />
    </div>
  );
}

function StepRowFields({
  step,
  index,
  onUpdate,
  onRemove,
  disableRemove,
  showDuration,
  dragHandleProps,
}: {
  step: StepWithId;
  index: number;
  onUpdate: (index: number, field: keyof Step, value: string | number | undefined) => void;
  onRemove: (index: number) => void;
  disableRemove: boolean;
  showDuration: boolean;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <>
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 mt-2.5"
        {...dragHandleProps}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex items-center justify-center h-9 w-9 rounded-full bg-muted text-sm font-medium shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 space-y-2">
        <Textarea
          placeholder={`${t("form.step")} ${index + 1}`}
          value={step.instruction}
          onChange={(e) => onUpdate(index, "instruction", e.target.value)}
          rows={2}
        />
        {showDuration && (
          <Input
            type="number"
            min={0}
            placeholder={t("form.durationMin")}
            value={step.duration ?? ""}
            onChange={(e) => onUpdate(index, "duration", e.target.value === "" ? undefined : Number(e.target.value))}
            className="w-36"
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        disabled={disableRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );
}

function SortableStepRow({
  step,
  index,
  onUpdate,
  onRemove,
  disableRemove,
  showDuration,
}: {
  step: StepWithId;
  index: number;
  onUpdate: (index: number, field: keyof Step, value: string | number | undefined) => void;
  onRemove: (index: number) => void;
  disableRemove: boolean;
  showDuration: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step._dndId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <StepRowFields
        step={step}
        index={index}
        onUpdate={onUpdate}
        onRemove={onRemove}
        disableRemove={disableRemove}
        showDuration={showDuration}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function StaticStepRow({
  step,
  index,
  onUpdate,
  onRemove,
  disableRemove,
  showDuration,
}: {
  step: StepWithId;
  index: number;
  onUpdate: (index: number, field: keyof Step, value: string | number | undefined) => void;
  onRemove: (index: number) => void;
  disableRemove: boolean;
  showDuration: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <StepRowFields
        step={step}
        index={index}
        onUpdate={onUpdate}
        onRemove={onRemove}
        disableRemove={disableRemove}
        showDuration={showDuration}
        dragHandleProps={{ "aria-hidden": true, tabIndex: -1 }}
      />
    </div>
  );
}

export default function RecipeForm({ initial, tags: initialTags = [], collections: initialCollections = [] }: Props) {
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [ingredients, setIngredients] = useState<IngredientWithId[]>(
    initial?.ingredients?.length ? initial.ingredients.map(withDndId) : [withDndId({ ...emptyIngredient })]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setIngredients((items) => {
        const oldIndex = items.findIndex((i) => i._dndId === active.id);
        const newIndex = items.findIndex((i) => i._dndId === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }
  const [steps, setSteps] = useState<StepWithId[]>(
    initial?.steps?.length ? initial.steps.map(withStepDndId) : [withStepDndId(emptyStep(1))]
  );
  const [showStepDurations, setShowStepDurations] = useState(false);
  const [showGroups, setShowGroups] = useState(false);

  function handleStepDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((s) => s._dndId === active.id);
        const newIndex = items.findIndex((s) => s._dndId === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }
  const [servings, setServings] = useState<NumericInputValue>(initial?.servings ?? 4);
  const [prepTime, setPrepTime] = useState<NumericInputValue>(initial?.prepTime ?? "");
  const [cookTime, setCookTime] = useState<NumericInputValue>(initial?.cookTime ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty || "medium");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl || "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [imageProvider, setImageProvider] = useState<RecipeData["imageProvider"]>(
    normalizeImageProvider(initial?.imageProvider)
  );
  const [imageAuthorName, setImageAuthorName] = useState(initial?.imageAuthorName || "");
  const [imageAuthorUrl, setImageAuthorUrl] = useState(initial?.imageAuthorUrl || "");
  const [imageSourceUrl, setImageSourceUrl] = useState(initial?.imageSourceUrl || "");
  const [coverSearchQuery, setCoverSearchQuery] = useState((initial?.title || "").trim());
  const [coverSearchTouched, setCoverSearchTouched] = useState(false);
  const [coverSearchResults, setCoverSearchResults] = useState<UnsplashPhotoResult[]>([]);
  const [coverSearchLoading, setCoverSearchLoading] = useState(false);
  const [coverSearchError, setCoverSearchError] = useState("");
  const [coverSearchSubmitted, setCoverSearchSubmitted] = useState(false);
  const [showCoverSearch, setShowCoverSearch] = useState(false);
  const [availableTags, setAvailableTags] = useState(initialTags);
  const [availableCollections, setAvailableCollections] = useState(initialCollections);
  const [selectedTags, setSelectedTags] = useState<number[]>(initial?.tagIds || []);
  const [selectedCollections, setSelectedCollections] = useState<number[]>(
    initial?.collectionIds || []
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const coverSearchInputRef = useRef<HTMLInputElement>(null);

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    setCreatingTag(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const tag = await res.json();
      if (tag.id) {
        setAvailableTags((prev) => prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]);
        setSelectedTags((prev) => prev.includes(tag.id) ? prev : [...prev, tag.id]);
        setNewTagName("");
      }
    } catch {}
    setCreatingTag(false);
  }

  async function createCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    setCreatingCollection(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const col = await res.json();
      if (col.id) {
        setAvailableCollections((prev) => prev.some((c) => c.id === col.id) ? prev : [...prev, col]);
        setSelectedCollections((prev) => prev.includes(col.id) ? prev : [...prev, col.id]);
        setNewCollectionName("");
      }
    } catch {}
    setCreatingCollection(false);
  }

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!coverSearchTouched) {
      setCoverSearchQuery(title.trim());
    }
  }, [title, coverSearchTouched]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 640) {
      setShowGroups(true);
    }
  }, []);

  useEffect(() => {
    if (showCoverSearch) {
      coverSearchInputRef.current?.focus();
      coverSearchInputRef.current?.select();
    }
  }, [showCoverSearch]);

  function clearImageMetadata() {
    setImageProvider(undefined);
    setImageAuthorName("");
    setImageAuthorUrl("");
    setImageSourceUrl("");
  }

  function handleUploadedImageChange(url: string) {
    setImageUrl(url);
    if (!url) {
      clearImageMetadata();
      return;
    }
    setImageProvider("upload");
    setImageAuthorName("");
    setImageAuthorUrl("");
    setImageSourceUrl("");
  }

  function applyUnsplashSelection(photo: UnsplashPhotoResult) {
    setImageUrl(photo.regularUrl);
    setImageProvider("unsplash");
    setImageAuthorName(photo.authorName);
    setImageAuthorUrl(photo.authorUrl);
    setImageSourceUrl(photo.photoUrl);
    setCoverSearchResults([]);
    setCoverSearchSubmitted(false);
    setCoverSearchError("");
    setShowCoverSearch(false);

    void fetch("/api/unsplash/track-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downloadLocation: photo.downloadLocation }),
    }).catch(() => {});
  }

  async function searchCoverPhotos() {
    const query = coverSearchQuery.trim();
    if (!query) {
      setCoverSearchSubmitted(true);
      setCoverSearchResults([]);
      setCoverSearchError(t("recipe.coverSearchEmptyQuery"));
      return;
    }

    setCoverSearchLoading(true);
    setCoverSearchSubmitted(true);
    setCoverSearchError("");

    try {
      const params = new URLSearchParams({ q: query });
      const res = await fetch(`/api/unsplash/search?${params.toString()}`);
      const data = await res.json().catch(() => null) as { results?: UnsplashPhotoResult[]; error?: string } | null;

      if (!res.ok) {
        setCoverSearchResults([]);
        setCoverSearchError(data?.error || t("recipe.coverSearchError"));
        setCoverSearchLoading(false);
        return;
      }

      setCoverSearchResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setCoverSearchResults([]);
      setCoverSearchError(t("recipe.coverSearchError"));
    }

    setCoverSearchLoading(false);
  }

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  }

  function addIngredient() {
    setIngredients([...ingredients, withDndId({ ...emptyIngredient })]);
  }

  function removeIngredient(index: number) {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: keyof Step, value: string | number | undefined) {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  }

  function addStep() {
    setSteps([...steps, withStepDndId(emptyStep(steps.length + 1))]);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, i) => i !== index);
    setSteps(updated.map((s, i) => ({ ...s, order: i + 1 })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const validIngredients = ingredients
      .filter((i) => i.name.trim())
      .map(({ _dndId, ...rest }) => rest);
    const validSteps = steps
      .filter((s) => s.instruction.trim())
      .map(({ _dndId, ...rest }, i) => ({ ...rest, order: i + 1 }));

    if (validIngredients.length === 0) {
      setError(t("form.errorIngredient"));
      setSaving(false);
      return;
    }
    if (validSteps.length === 0) {
      setError(t("form.errorStep"));
      setSaving(false);
      return;
    }

    const payload = {
      title,
      description: description || undefined,
      ingredients: validIngredients,
      steps: validSteps,
      servings: toOptionalPositiveNumber(servings),
      prepTime: toOptionalPositiveNumber(prepTime),
      cookTime: toOptionalPositiveNumber(cookTime),
      difficulty,
      imageUrl: imageUrl || undefined,
      imageProvider: imageUrl ? normalizeImageProvider(imageProvider) : undefined,
      imageAuthorName: imageUrl ? imageAuthorName || undefined : undefined,
      imageAuthorUrl: imageUrl ? imageAuthorUrl || undefined : undefined,
      imageSourceUrl: imageUrl ? imageSourceUrl || undefined : undefined,
      sourceUrl: sourceUrl || undefined,
      videoUrl: videoUrl || undefined,
      notes: notes || undefined,
      tagIds: selectedTags.length ? selectedTags : undefined,
      collectionIds: selectedCollections.length ? selectedCollections : undefined,
    };

    try {
      const url = isEdit ? `/api/recipes/${initial!.id}` : "/api/recipes";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data.error, t("form.errorSave")));
        setSaving(false);
        return;
      }

      const recipe = await res.json();
      window.location.href = `/recipes/${recipe.slug}`;
    } catch {
      setError(t("common.error"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      {/* Title & Description */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t("form.titleRequired")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={t("form.titlePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">{t("recipe.description")}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("form.descriptionPlaceholder")}
            rows={2}
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="servings">{t("recipe.servings")}</Label>
          <Input
            id="servings"
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(parseNumericInput(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prepTime">{t("form.prepMin")}</Label>
          <Input
            id="prepTime"
            type="number"
            min={0}
            value={prepTime}
            onChange={(e) => setPrepTime(parseNumericInput(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cookTime">{t("form.cookMin")}</Label>
          <Input
            id="cookTime"
            type="number"
            min={0}
            value={cookTime}
            onChange={(e) => setCookTime(parseNumericInput(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="difficulty">{t("recipe.difficulty")}</Label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="easy">{t("recipe.easy")}</option>
            <option value="medium">{t("recipe.medium")}</option>
            <option value="hard">{t("recipe.hard")}</option>
          </select>
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-3">
        <Label>{t("form.ingredientsRequired")}</Label>
        {isHydrated ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ingredients.map((i) => i._dndId)} strategy={verticalListSortingStrategy}>
              {ingredients.map((ing, i) => (
                <SortableIngredientRow
                  key={ing._dndId}
                  ing={ing}
                  index={i}
                  onUpdate={updateIngredient}
                  onRemove={removeIngredient}
                  disableRemove={ingredients.length <= 1}
                  showGroup={showGroups}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <StaticIngredientRow
                key={ing._dndId}
                ing={ing}
                index={i}
                onUpdate={updateIngredient}
                onRemove={removeIngredient}
                disableRemove={ingredients.length <= 1}
                showGroup={showGroups}
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <Plus className="h-4 w-4 mr-1" />
            {t("recipe.addIngredient")}
          </Button>
          <Button
            type="button"
            variant={showGroups ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowGroups((v) => !v)}
          >
            <Layers className="h-4 w-4 mr-1" />
            {t("form.showGroups")}
          </Button>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <Label>{t("form.stepsRequired")}</Label>
        {isHydrated ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd}>
            <SortableContext items={steps.map((s) => s._dndId)} strategy={verticalListSortingStrategy}>
              {steps.map((step, i) => (
                <SortableStepRow
                  key={step._dndId}
                  step={step}
                  index={i}
                  onUpdate={updateStep}
                  onRemove={removeStep}
                  disableRemove={steps.length <= 1}
                  showDuration={showStepDurations}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-2">
            {steps.map((step, i) => (
              <StaticStepRow
                key={step._dndId}
                step={step}
                index={i}
                onUpdate={updateStep}
                onRemove={removeStep}
                disableRemove={steps.length <= 1}
                showDuration={showStepDurations}
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-4 w-4 mr-1" />
            {t("recipe.addStep")}
          </Button>
          <Button
            type="button"
            variant={showStepDurations ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowStepDurations((v) => !v)}
          >
            <Clock className="h-4 w-4 mr-1" />
            {t("form.showDurations")}
          </Button>
        </div>
      </div>

      {/* Image Upload */}
      <div className="space-y-4">
        <Label>{t("recipe.image")}</Label>
        <ImageUpload value={imageUrl} onChange={handleUploadedImageChange} />

        {!imageUrl && !showCoverSearch ? (
          <button
            type="button"
            onClick={() => setShowCoverSearch(true)}
            className="text-sm text-primary hover:underline underline-offset-4"
          >
            {t("recipe.coverSearchTitle")}
          </button>
        ) : !imageUrl && showCoverSearch ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 p-4 sm:p-5 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">{t("recipe.coverSearchHelper")}</p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                ref={coverSearchInputRef}
                value={coverSearchQuery}
                onChange={(e) => {
                  setCoverSearchTouched(true);
                  setCoverSearchQuery(e.target.value);
                  if (coverSearchError) setCoverSearchError("");
                }}
                placeholder={t("recipe.coverSearchPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchCoverPhotos();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={searchCoverPhotos}
                disabled={coverSearchLoading}
                className="sm:min-w-28"
              >
                {coverSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {coverSearchLoading ? t("recipe.coverSearchLoading") : t("recipe.coverSearchButton")}
              </Button>
            </div>

            {imageProvider === "unsplash" && imageAuthorName && imageAuthorUrl && imageSourceUrl && (
              <p className="text-xs text-muted-foreground">
                {t("recipe.coverPhotoBy")}{" "}
                <a href={imageAuthorUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {imageAuthorName}
                </a>{" "}
                {t("recipe.onUnsplash")}{" "}
                <a href={imageSourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Unsplash
                </a>
              </p>
            )}

            {coverSearchError && (
              <p className="text-sm text-destructive">{coverSearchError}</p>
            )}

            {coverSearchSubmitted && !coverSearchLoading && !coverSearchError && coverSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("recipe.coverSearchNoResults")}</p>
            )}

            {coverSearchResults.length > 0 && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {coverSearchResults.map((photo) => {
                  const isSelected = imageProvider === "unsplash" && imageUrl === photo.regularUrl;

                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => applyUnsplashSelection(photo)}
                      className={`overflow-hidden rounded-2xl border bg-background/70 transition-colors text-left ${
                        isSelected ? "border-primary shadow-sm shadow-primary/10" : "border-border/40"
                      }`}
                    >
                      <div className="relative aspect-[4/3] bg-muted/40">
                        <img
                          src={photo.smallUrl}
                          alt={photo.alt}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute right-2 top-2 rounded-full bg-background/90 p-1 text-primary shadow-sm">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>{t("recipe.tags")}</Label>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() =>
                setSelectedTags((prev) =>
                  prev.includes(tag.id)
                    ? prev.filter((id) => id !== tag.id)
                    : [...prev, tag.id]
                )
              }
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selectedTags.includes(tag.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent border-border hover:bg-accent"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder={t("form.newTag")}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createTag();
              }
            }}
            className="w-40 h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={createTag}
            disabled={creatingTag || !newTagName.trim()}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("form.add")}
          </Button>
        </div>
      </div>

      {/* Collections */}
      <div className="space-y-2">
        <Label>{t("recipe.collections")}</Label>
        <div className="flex flex-wrap gap-2">
          {availableCollections.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() =>
                setSelectedCollections((prev) =>
                  prev.includes(col.id)
                    ? prev.filter((id) => id !== col.id)
                    : [...prev, col.id]
                )
              }
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selectedCollections.includes(col.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent border-border hover:bg-accent"
              }`}
            >
              {col.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder={t("form.newCollection")}
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createCollection();
              }
            }}
            className="w-40 h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={createCollection}
            disabled={creatingCollection || !newCollectionName.trim()}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t("form.add")}
          </Button>
        </div>
      </div>

      {/* Source URL, Video URL & Notes */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sourceUrl">{t("recipe.sourceUrl")}</Label>
          <Input
            id="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="videoUrl">{t("form.videoUrl")}</Label>
          <Input
            id="videoUrl"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">{t("recipe.notes")}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("form.notesPlaceholder")}
            rows={3}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t("form.saving") : isEdit ? t("form.updateRecipe") : t("form.createRecipe")}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          {t("recipe.cancel")}
        </Button>
      </div>
    </form>
  );
}
