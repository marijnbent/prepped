# Prepped

![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)

A self-hosted recipe manager for families and small groups. Import recipes from any URL with AI, scale servings, track cooking attempts, and organize everything with collections and tags.

## Features

- **Import recipes** from any URL — AI extracts ingredients, steps, and metadata
- **Paste recipe text** — AI structures it for you
- **Photo import** — snap a cookbook page and get a structured recipe
- **Metric conversion** — imported recipes are auto-converted to metric
- **Servings scaler** — adjust servings and all ingredients scale in real time
- **AI chat** — ask questions about any recipe (substitutions, tips, technique)
- **Cook log** — track when you made a recipe, with photos, notes, and ratings
- **Fork recipes** — copy a community recipe to your own collection and customize it
- **Collections & tags** — organize recipes your way
- **Shopping list** — combine ingredients from multiple recipes, organize with AI
- **YouTube videos** — embedded on recipe pages when available
- **Mobile-friendly** — responsive design, works great on phones
- **Multi-language** — English and Dutch (`PUBLIC_UI_LOCALE`)
- **Single-file database** — SQLite, backup = copy one folder

## Quick Start with Docker

```sh
git clone <your-repo-url>
cd prepped
cp .env.example .env
# Edit .env — at minimum set BETTER_AUTH_SECRET and OPENROUTER_API_KEY
docker compose up -d
```

The app will be available at `http://localhost:4321`.

## Quick Start without Docker

```sh
git clone <your-repo-url>
cd prepped
npm install
cp .env.example .env
# Edit .env with your settings
npx drizzle-kit push    # Create database tables
npm run dev             # Start dev server at localhost:4321
```

### Seed dev data

Populate the database with test users and sample recipes:

```sh
npm run seed
```

This creates 3 users (`chef@test.com`, `maria@test.com`, `james@test.com` — all password `test1234`) with ~12 recipes, cook logs, and cross-user forks.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BETTER_AUTH_SECRET` | Yes | Session secret. Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | Public URL (e.g., `https://prepped.example.com`) |
| `UNSPLASH_ACCESS_KEY` | No | Unsplash Access Key for recipe cover photo search ([create an app here](https://unsplash.com/documentation)) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI features ([get one here](https://openrouter.ai/keys)) |
| `OPENROUTER_PRIMARY_MODEL` | No | Primary OpenRouter model (default: `google/gemini-3-flash-preview`) |
| `OPENROUTER_FALLBACK_MODEL` | No | Backup OpenRouter model (default: `openai/gpt-5-mini`) |
| `OPENROUTER_FALLBACK_MODELS` | No | Comma-separated fallback chain (overrides `OPENROUTER_FALLBACK_MODEL`) |
| `OPENROUTER_BASE_URL` | No | OpenRouter API base URL (default: `https://openrouter.ai/api/v1`) |
| `OPENROUTER_APP_NAME` | No | App name sent in OpenRouter request headers (default: `Prepped`) |
| `SCRAPE_DO_TOKEN` | No | scrape.do API token for fallback when direct import is blocked |
| `SCRAPE_DO_BASE_URL` | No | scrape.do base URL (default: `http://api.scrape.do/`) |
| `SCRAPE_DO_GEO_CODE` | No | scrape.do geo code (default: `NL`) |
| `INVITE_CODE` | No | If set, new users must enter this code to register |
| `MEASUREMENT_SYSTEM` | No | `metric` (default) or `imperial` |
| `PUBLIC_UI_LOCALE` | No | `en` (default) or `nl` |

## Data & Backups

All data lives in the `data/` directory (or Docker volume):
- `data/prepped.db` — SQLite database
- `data/uploads/` — uploaded images

To backup: copy the `data/` directory. To restore: put it back.

For a consistent SQLite snapshot while WAL mode is enabled, use:

```sh
npm run backup:db
```

That writes a timestamped `.db` backup to `data/backups/` and keeps 14 days by default.

Useful options:
- `BACKUP_DIR=/path/to/backups npm run backup:db`
- `BACKUP_RETENTION_DAYS=30 npm run backup:db`
- `DATA_DIR=/custom/data npm run backup:db`

Daily backup examples:

Without Docker:

```cron
0 3 * * * cd /path/to/prepped && /usr/bin/env BACKUP_RETENTION_DAYS=30 npm run backup:db >> /var/log/prepped-backup.log 2>&1
```

With Docker Compose:

```cron
0 3 * * * cd /path/to/prepped && docker compose exec -T prepped /usr/bin/env BACKUP_RETENTION_DAYS=30 npm run backup:db >> /var/log/prepped-backup.log 2>&1
```

If you want full disaster recovery, back up `data/uploads/` too or snapshot the whole `data/` directory/volume on a schedule.

To push both the database snapshot and uploaded images to Scaleway S3, use:

```sh
npm run backup:s3
```

This uploads:
- `data/prepped.db` as a consistent snapshot to `s3://bentbackup/recepten.bentjes.nl/YYYY-MM-DD/prepped-...db`
- `data/uploads/` to one shared folder at `s3://bentbackup/recepten.bentjes.nl/images/...`

Image backups are deduplicated by path: if an image already exists in the shared S3 `images/` folder, it is skipped on later runs.

Required environment variables:
- `SCW_ACCESS_KEY`
- `SCW_SECRET_KEY`

Optional environment variables:
- `SCW_REGION=fr-par`
- `SCW_ENDPOINT=https://s3.fr-par.scw.cloud`
- `SCW_BUCKET=bentbackup`
- `S3_BACKUP_PREFIX=recepten.bentjes.nl`
- `DATA_DIR=/custom/data`
- `DB_PATH=prepped.db`
- `UPLOADS_DIR=/custom/uploads`

Daily backup example:

```cron
0 3 * * * cd /path/to/prepped && /usr/bin/env SCW_ACCESS_KEY=... SCW_SECRET_KEY=... npm run backup:s3 >> /var/log/prepped-s3-backup.log 2>&1
```

If you're using Docker Compose, the repo now includes a `prepped-backup` service that runs this automatically once per day. It shares the same `data/` volume as the app and uploads to Scaleway S3 on schedule.

Backup scheduler settings:
- `BACKUP_TIME=03:00` runs the backup daily at 03:00 in the container timezone
- `BACKUP_RUN_ON_START=true` also runs one backup right after the container starts
- `TZ=Europe/Amsterdam` sets the timezone used by the daily scheduler

Start both services:

```sh
docker compose up -d
```

## Production Deployment

For production behind a reverse proxy (nginx, Caddy, etc.):

1. Set `BETTER_AUTH_URL` to your public URL
2. Set `BETTER_AUTH_SECRET` to a strong random value
3. Configure your reverse proxy to forward to port 4321
4. Optionally set `INVITE_CODE` to restrict registration
5. Do not rely on schema auto-sync on boot for production SQLite data

Recommended production migration flow:

```sh
cp data/prepped.db data/prepped-$(date +%F-%H%M%S).db
npm run db:generate
# review the SQL files in drizzle/
npm run db:migrate
```

The container no longer runs `drizzle-kit push --force` automatically. Startup now just launches the app; schema changes should be applied explicitly with reviewed Drizzle migrations.

Avoid `drizzle-kit push --force` against production SQLite databases. Table rebuilds can be destructive.

If you already had a running database before `drizzle/` was added to the repo, run this once before your first `db:migrate`:

```sh
npm run db:baseline
```

That stamps the current migration history into `__drizzle_migrations` without changing your existing tables or rows.

## Tech Stack

- [Astro](https://astro.build) (SSR, Node.js adapter) + React islands
- [Shadcn UI](https://ui.shadcn.com) + Tailwind CSS v4
- [SQLite](https://sqlite.org) (better-sqlite3) + [Drizzle ORM](https://orm.drizzle.team)
- [Better Auth](https://better-auth.com) (email/password)
- [AI SDK](https://sdk.vercel.ai) + [OpenRouter](https://openrouter.ai)
- [Sharp](https://sharp.pixelplumbing.com) for image processing

## Troubleshooting

### `Uncaught TypeError: jsxDEV is not a function`

Happens when the dev server runs with `NODE_ENV=production`. Clear Vite cache:

```sh
npm run dev:clean
```

### `504 (Outdated Optimize Dep)`

Vite's pre-bundled dependency cache is stale. Reset with:

```sh
npm run dev:clean
```

### AI errors (`AI_APICallError`, `401/403`, `429`)

- Verify `.env` has a valid `OPENROUTER_API_KEY`
- Check that model IDs (`OPENROUTER_PRIMARY_MODEL`, `OPENROUTER_FALLBACK_MODEL`) are valid
- Restart the server after changing env vars

## License

MIT
