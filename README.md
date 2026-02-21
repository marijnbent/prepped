# Prepped

A self-hosted recipe management app for families. Scrape recipes from URLs, refine them with AI, scale servings, track cooking attempts with photos, and chat with AI about any recipe.

## Features

- **Import recipes** from any URL — AI extracts ingredients, steps, and metadata
- **Paste recipe text** — AI structures it for you
- **Metric conversion** — imported recipes are auto-converted to metric
- **Servings scaler** — adjust servings and all ingredients scale in real time
- **AI chat** — ask questions about any recipe (substitutions, tips, technique)
- **Cook log** — track when you made a recipe, with photos, notes, and ratings
- **Collections & tags** — organize recipes your way
- **YouTube videos** — embedded on recipe pages when available
- **Mobile-friendly** — responsive design, works great on phones
- **Multi-language** — English and Dutch (via `PUBLIC_UI_LOCALE` env var)
- **Single-file database** — SQLite, backup = copy one folder

## Quick Start with Docker

```sh
git clone https://github.com/your-username/prepped.git
cd prepped
cp .env.example .env
# Edit .env with your settings (at minimum set BETTER_AUTH_SECRET and OPENROUTER_API_KEY)
docker compose up -d
```

The app will be available at `http://localhost:4321`.

## Quick Start without Docker

```sh
git clone https://github.com/your-username/prepped.git
cd prepped
npm install
cp .env.example .env
# Edit .env with your settings
npx drizzle-kit push
npm run dev
```

## Dev Troubleshooting

### `504 (Outdated Optimize Dep)` in the browser console

This error means Vite's pre-bundled dependency cache is stale relative to currently loaded client islands.  
It can happen during active development when dependencies or import graphs change.

Use the clean dev command to reset cache and force re-optimization:

```sh
npm run dev:clean
```

Rule of thumb for this codebase:
- Keep AI/auth SDK clients server-side (API routes and server libs)
- Keep client islands dependency-light and call server APIs via `fetch`

### AI auth/config failures (`AI_APICallError`, `401/403`, `429`)

Symptom:
- AI actions (new recipe import or recipe chat) fail with provider auth errors.

Likely causes:
- `OPENROUTER_API_KEY` is missing or empty in runtime environment.
- API key is invalid, expired, or restricted to a different project/service.
- The configured model is not enabled for your OpenRouter account.

Quick checks:
- Verify `.env` has a valid `OPENROUTER_API_KEY`.
- Verify `OPENROUTER_PRIMARY_MODEL` and `OPENROUTER_FALLBACK_MODEL` are valid OpenRouter model IDs.
- Restart the server after changing env vars.
- Test with a newly generated key from OpenRouter.

Server-side behavior:
- AI API routes sanitize provider errors and return JSON error responses (`{ error, code }`) so frontend actions can fail gracefully without raw error pages.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | Yes | Session secret. Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | Public URL (e.g., `https://prepped.example.com`) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI features ([get one here](https://openrouter.ai/keys)) |
| `OPENROUTER_PRIMARY_MODEL` | No | Primary OpenRouter model (default: `google/gemini-flash-latest`) |
| `OPENROUTER_FALLBACK_MODEL` | No | Backup OpenRouter model (default: `openai/gpt-5-mini`) |
| `OPENROUTER_FALLBACK_MODELS` | No | Optional comma-separated backups (overrides `OPENROUTER_FALLBACK_MODEL`) |
| `OPENROUTER_BASE_URL` | No | OpenRouter API base URL (default: `https://openrouter.ai/api/v1`) |
| `OPENROUTER_APP_NAME` | No | App name sent in OpenRouter request headers (default: `Prepped`) |
| `INVITE_CODE` | No | If set, new users must enter this code to register. Leave empty for open registration |
| `MEASUREMENT_SYSTEM` | No | `metric` (default) or `imperial` |
| `PUBLIC_UI_LOCALE` | No | `en` (default) or `nl` |

## Data & Backups

All data lives in the `data/` directory (or Docker volume):
- `data/recepten.db` — SQLite database
- `data/uploads/` — uploaded images

To backup: copy the `data/` directory. To restore: put it back.

## Production Deployment

For production behind a reverse proxy (nginx, Caddy, etc.):

1. Set `BETTER_AUTH_URL` to your public URL
2. Set `BETTER_AUTH_SECRET` to a strong random value
3. Configure your reverse proxy to forward to port 4321
4. Optionally set `INVITE_CODE` to restrict registration to your family

## Tech Stack

- [Astro](https://astro.build) (SSR, Node.js adapter) + React islands
- [Shadcn UI](https://ui.shadcn.com) + Tailwind CSS v4
- [SQLite](https://sqlite.org) (better-sqlite3) + [Drizzle ORM](https://orm.drizzle.team)
- [Better Auth](https://better-auth.com) (email/password)
- [AI SDK](https://sdk.vercel.ai) + [OpenRouter](https://openrouter.ai) (`google/gemini-flash-latest` with `openai/gpt-5-mini` fallback)
- [Sharp](https://sharp.pixelplumbing.com) for image processing

## Local Quality Gate

There is no CI workflow configured in this repository right now.  
Before opening a PR, run at minimum:

```sh
npm run check:client-boundaries
npm run build
```

## License

MIT
