import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import ImageUpload from "./ImageUpload";
import { t } from "@/lib/i18n";

interface Ingredient {
  amount: string;
  unit: string;
  name: string;
  group?: string;
}

interface Step {
  order: number;
  instruction: string;
  duration?: number;
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
  sourceUrl?: string;
  videoUrl?: string;
  notes?: string;
  tagIds?: number[];
  collectionIds?: number[];
}

interface Props {
  initial?: RecipeData;
  tags?: { id: number; name: string }[];
  collections?: { id: number; name: string }[];
}

const emptyIngredient: Ingredient = { amount: "", unit: "", name: "" };
const emptyStep = (order: number): Step => ({ order, instruction: "" });

export default function RecipeForm({ initial, tags: initialTags = [], collections: initialCollections = [] }: Props) {
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initial?.ingredients?.length ? initial.ingredients : [{ ...emptyIngredient }]
  );
  const [steps, setSteps] = useState<Step[]>(
    initial?.steps?.length ? initial.steps : [emptyStep(1)]
  );
  const [servings, setServings] = useState(initial?.servings || 4);
  const [prepTime, setPrepTime] = useState(initial?.prepTime || 0);
  const [cookTime, setCookTime] = useState(initial?.cookTime || 0);
  const [difficulty, setDifficulty] = useState(initial?.difficulty || "medium");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl || "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [availableTags, setAvailableTags] = useState(initialTags);
  const [availableCollections, setAvailableCollections] = useState(initialCollections);
  const [selectedTags, setSelectedTags] = useState<number[]>(initial?.tagIds || []);
  const [selectedCollections, setSelectedCollections] = useState<number[]>(
    initial?.collectionIds || []
  );
  const [newTagName, setNewTagName] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);

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

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  }

  function addIngredient() {
    setIngredients([...ingredients, { ...emptyIngredient }]);
  }

  function removeIngredient(index: number) {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateStep(index: number, instruction: string) {
    const updated = [...steps];
    updated[index] = { ...updated[index], instruction };
    setSteps(updated);
  }

  function addStep() {
    setSteps([...steps, emptyStep(steps.length + 1)]);
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

    const validIngredients = ingredients.filter((i) => i.name.trim());
    const validSteps = steps
      .filter((s) => s.instruction.trim())
      .map((s, i) => ({ ...s, order: i + 1 }));

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
      servings: servings || undefined,
      prepTime: prepTime || undefined,
      cookTime: cookTime || undefined,
      difficulty,
      imageUrl: imageUrl || undefined,
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
        setError(data.error?.toString() || t("form.errorSave"));
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
            onChange={(e) => setServings(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prepTime">{t("form.prepMin")}</Label>
          <Input
            id="prepTime"
            type="number"
            min={0}
            value={prepTime}
            onChange={(e) => setPrepTime(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cookTime">{t("form.cookMin")}</Label>
          <Input
            id="cookTime"
            type="number"
            min={0}
            value={cookTime}
            onChange={(e) => setCookTime(Number(e.target.value))}
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
        {ingredients.map((ing, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-2">
            <div className="flex items-center gap-2 min-w-0 sm:flex-1">
              <Input
                placeholder={t("form.amount")}
                value={ing.amount}
                onChange={(e) => updateIngredient(i, "amount", e.target.value)}
                className="w-20"
              />
              <Input
                placeholder={t("form.unit")}
                value={ing.unit}
                onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                className="w-20"
              />
              <Input
                placeholder={t("form.ingredientName")}
                value={ing.name}
                onChange={(e) => updateIngredient(i, "name", e.target.value)}
                className="flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeIngredient(i)}
                disabled={ingredients.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder={t("form.group")}
              value={ing.group || ""}
              onChange={(e) => updateIngredient(i, "group", e.target.value)}
              className="w-full sm:w-28"
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
          <Plus className="h-4 w-4 mr-1" />
          {t("recipe.addIngredient")}
        </Button>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <Label>{t("form.stepsRequired")}</Label>
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="flex items-center justify-center h-9 w-9 rounded-full bg-muted text-sm font-medium shrink-0">
              {i + 1}
            </span>
            <Textarea
              placeholder={`${t("form.step")} ${i + 1}`}
              value={step.instruction}
              onChange={(e) => updateStep(i, e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeStep(i)}
              disabled={steps.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addStep}>
          <Plus className="h-4 w-4 mr-1" />
          {t("recipe.addStep")}
        </Button>
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>{t("recipe.image")}</Label>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
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
