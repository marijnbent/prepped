import { db } from "./db";
import { tags, collections } from "./schema";
import { slugify } from "./slugify";
import { eq, and } from "drizzle-orm";
import { getDefaultCollections, defaultTags } from "./defaults";

export function seedTags() {
  for (const name of defaultTags) {
    const slug = slugify(name);
    if (!slug) continue;
    const existing = db.select().from(tags).where(eq(tags.slug, slug)).get();
    if (!existing) {
      db.insert(tags).values({ name, slug }).run();
    }
  }
}

export function seedUserDefaults(userId: string, locale?: string) {
  for (const name of getDefaultCollections(locale ?? import.meta.env.PUBLIC_UI_LOCALE)) {
    const slug = slugify(name);
    if (!slug) continue;
    const existing = db
      .select()
      .from(collections)
      .where(and(eq(collections.slug, slug), eq(collections.createdBy, userId)))
      .get();
    if (!existing) {
      db.insert(collections).values({ name, slug, createdBy: userId }).run();
    }
  }
}

export function seedDefaults() {
  seedTags();
}
