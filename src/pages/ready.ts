import type { APIRoute } from "astro";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";

export const GET: APIRoute = () => {
  try {
    const requiredTables = ["users", "recipes", "shopping_lists", "recipe_comments", "notifications"];
    const rows = db.all(sql`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('users', 'recipes', 'shopping_lists', 'recipe_comments', 'notifications')
    `) as Array<{ name: string }>;
    const presentTables = new Set(rows.map((row) => row.name));
    if (requiredTables.some((table) => !presentTables.has(table))) {
      throw new Error("Database schema is incomplete");
    }
    return Response.json({ ok: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ ok: false }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
};
