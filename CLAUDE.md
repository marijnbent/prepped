# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:4321)
npm run build        # Production build
npm run preview      # Preview production build
npx drizzle-kit push # Sync schema changes to SQLite (no migrations)
```

No test runner or linter is configured.

## Architecture

**Astro SSR + React islands.** Astro handles routing, SSR, and static components. React islands (`src/islands/`) provide client-side interactivity and are hydrated with `client:load` or `client:visible`. Astro components (`src/components/`) ship zero JS.

**Rendering model:** All pages are server-rendered (`output: "server"` in astro.config.mjs). The `@astrojs/node` adapter runs standalone. Pages are in `src/pages/`, API routes in `src/pages/api/`.

**Auth flow:** Better Auth handles email/password auth. Middleware (`src/middleware.ts`) resolves the session on every request and sets `Astro.locals.user` (typed in `src/env.d.ts`). API routes check `locals.user` for auth guards.

**Database:** SQLite via better-sqlite3 with Drizzle ORM. DB file is `data/prepped.db`. Schema uses `drizzle-kit push` (not migrations). Ingredients and steps are stored as JSON columns (`text` with `mode: "json"`) typed as `Ingredient[]` and `Step[]`.

**Image pipeline:** Sharp converts uploads to WebP in two sizes (1600px full, 400px thumb). Stored in `data/uploads/{recipes,cook-logs}/`. Served via catch-all route `src/pages/api/uploads/[...path].ts`.

**AI features:** Vercel AI SDK with Google Gemini Flash (`@ai-sdk/google`). Used for recipe import (URL scraping + AI extraction), text-to-recipe parsing, and per-recipe chat. Model configured in `src/lib/ai.ts`.

**i18n:** Static string map in `src/lib/i18n.ts` — English and Dutch. Locale selected via `UI_LOCALE` env var. Use `t("key")` for translations.

**Validation:** Zod schemas in `src/lib/validation.ts` validate all API input (recipes, cook logs, collections).

## Key Conventions

- Path alias `@/*` maps to `./src/*`
- Shadcn UI (new-york style) components live in `src/components/ui/` — add new ones via `npx shadcn@latest add <component>`
- Tailwind CSS v4 using the Vite plugin (not PostCSS) — theme tokens defined in `src/styles/globals.css` with `@theme inline`
- Database is synchronous (better-sqlite3) — no async needed for queries
- Slugs are auto-generated from titles; duplicates get a timestamp suffix
