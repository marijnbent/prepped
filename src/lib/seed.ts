import { db } from "./db";
import { tags, collections } from "./schema";
import { slugify } from "./slugify";
import { eq } from "drizzle-orm";
import { defaultCollections, defaultTags } from "./defaults";

export function seedDefaults() {
  for (const name of defaultTags) {
    const slug = slugify(name);
    if (!slug) continue;
    const existing = db.select().from(tags).where(eq(tags.slug, slug)).get();
    if (!existing) {
      db.insert(tags).values({ name, slug }).run();
    }
  }

  for (const name of defaultCollections) {
    const slug = slugify(name);
    if (!slug) continue;
    const existing = db.select().from(collections).where(eq(collections.slug, slug)).get();
    if (!existing) {
      db.insert(collections).values({ name, slug }).run();
    }
  }
}
