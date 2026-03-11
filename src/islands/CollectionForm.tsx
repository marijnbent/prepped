import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "./ImageUpload";
import { t } from "@/lib/i18n";
import { getApiErrorMessage } from "@/lib/api-errors";

interface Props {
  initial?: {
    id: number;
    name: string;
    description?: string;
    imageUrl?: string;
    sortOrder?: number;
  };
}

export default function CollectionForm({ initial }: Props) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder || 0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const url = isEdit ? `/api/collections/${initial!.id}` : "/api/collections";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          imageUrl: imageUrl || undefined,
          sortOrder,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, t("form.errorSaveGeneral")));
        setSaving(false);
        return;
      }

      const collection = await res.json();
      window.location.href = `/collections/${collection.slug}`;
    } catch {
      setError(t("common.error"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="name">{t("form.nameRequired")}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder={t("form.collectionPlaceholder")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">{t("recipe.description")}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("form.descriptionPlaceholder")}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("recipe.image")}</Label>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sortOrder">{t("form.sortOrder")}</Label>
        <Input
          id="sortOrder"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          className="w-24"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t("form.saving") : isEdit ? t("form.update") : t("form.createCollection")}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          {t("recipe.cancel")}
        </Button>
      </div>
    </form>
  );
}
