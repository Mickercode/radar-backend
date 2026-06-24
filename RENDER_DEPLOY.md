# Deploying radar-backend to Render

Node/Express + Prisma + Postgres (with `pgvector`). Repo:
`github.com/Mickercode/radar-backend`.

There are two ways to deploy: the **Blueprint** (one click, provisions the web
service *and* the database from `render.yaml`) or **Manual** (you click through
the dashboard). Use the Blueprint unless you want full control.

---

## Before you start — get a Gemini API key

The AI routes (`/capture`, quiz generation, insight auto-link) use Google
Gemini. Everything else works without it; those routes return `503` until it's set.

1. Go to **https://aistudio.google.com/app/apikey**
2. Create an API key, copy it. That's your `GEMINI_API_KEY`.

(There is no Anthropic dependency — `ANTHROPIC_API_KEY` is reserved and can stay blank.)

---

## Option A — Blueprint (recommended)

1. Push the repo to GitHub (already done).
2. Render dashboard → **New +** → **Blueprint**.
3. Connect the `radar-backend` repo. Render reads `render.yaml` and shows it will
   create: a **web service** `radar-api` + a **Postgres** `radar-db`.
4. It will prompt for the env vars marked `sync: false` —
   enter **`GEMINI_API_KEY`** (and leave `ANTHROPIC_API_KEY` blank).
5. Click **Apply**. Render will:
   - provision Postgres `radar-db`,
   - wire `DATABASE_URL` into the web service automatically,
   - generate a secure `APP_JWT_SECRET` automatically,
   - build (`npm install && npm run build && npx prisma db push`) — this creates the
     `pgvector`/`pgcrypto` extensions and all tables,
   - start (`npm run start`) and hit `/health`.

When the service is **Live**, note its URL, e.g. `https://radar-api.onrender.com`.

Then do the **two one-time steps** at the bottom (HNSW index + verify), and you're done.

> **Plans:** `render.yaml` uses `plan: starter` (web, ~$7/mo, no cold-start sleep)
> and `plan: basic-256mb` (Postgres). For pure testing you can change these to
> `free` in the dashboard — note Render's **free web service sleeps** after
> inactivity (first request after sleep is slow) and the **free Postgres expires
> after 30 days**.

---

## Option B — Manual (dashboard)

### 1. Create the database
- **New +** → **Postgres**. Name `radar-db`, pick a region, Postgres **16**, pick a plan.
- After it's created, copy the **Internal Database URL** (used by the web service
  in the same region) — this is your `DATABASE_URL`.

### 2. Create the web service
- **New +** → **Web Service** → connect the `radar-backend` repo.
- **Runtime:** Node · **Region:** same as the DB.
- **Build command:**
  ```
  npm install && npm run build && npx prisma db push --skip-generate
  ```
- **Start command:**
  ```
  npm run start
  ```
- **Health check path:** `/health`
- Add the env vars from the table below.
- **Create Web Service.**

---

## Environment variables — everything

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | *(the Postgres Internal URL)* | Blueprint wires this automatically. Manual: paste the Internal Database URL. |
| `APP_JWT_SECRET` | *(long random string)* | **Required.** Signs/verifies the JWTs. Blueprint auto-generates it. Manual: generate with `openssl rand -base64 48` (or `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). **Never change it after launch** — it invalidates every issued token. |
| `GEMINI_API_KEY` | *(your Gemini key)* | Needed for `/capture`, quiz generation, auto-link. Without it those return 503. |
| `NODE_ENV` | `production` | Enables prod error messages + logging. |
| `CORS_ORIGIN` | `*` then your PWA origin | Use `*` while testing. Once the PWA is deployed, set it to that origin, e.g. `https://radar.app` (comma-separate multiple). |
| `ANTHROPIC_API_KEY` | *(blank)* | Reserved, unused. Leave empty. |
| `PORT` | *(do not set)* | Render injects `PORT` automatically; the app reads it. Don't hardcode it. |

That's the complete list — the app validates them at startup (`src/config/env.ts`)
and **crashes immediately** if `DATABASE_URL` or `APP_JWT_SECRET` is missing, so a
misconfig fails fast instead of 500-ing later.

---

## Two one-time steps after the first deploy

### 1. Add the vector index (HNSW)
Prisma can't express the pgvector index, so add it once. In the Render dashboard
open the **radar-db** → **Connect** → **PSQL command**, run it, and paste:

```sql
CREATE INDEX IF NOT EXISTS insight_embedding_hnsw_idx
  ON insight_embedding USING hnsw (embedding vector_cosine_ops);
```

(It's in `prisma/sql/01_hnsw_index.sql`. The auto-link feature works without it,
just slower — safe to do anytime.)

### 2. Verify it's live
```bash
curl https://radar-api.onrender.com/health
# → {"ok":true,"service":"radar-backend"}

# Full round-trip:
curl -X POST https://radar-api.onrender.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123","name":"You"}'
# → {"token":"...","user":{...}}
```

---

## ⚠️ The feed will be empty until content is ingested

The deploy gives you a working **API**, but the `content` tables start empty, so
`GET /feed` returns nothing. Content is populated by the **ingestion worker**
(the old `ingest-content` RSS job), which isn't built yet — see
`BACKEND_HANDOFF.md` in the PWA repo. Until then, seed a few rows manually via
**radar-db → PSQL** (or Prisma Studio locally) to exercise the feed. Auth,
insights, capture, reviews, and quiz all work immediately without it.

---

## Point the PWA at it

In `radar-pwa`, set production env:
```
VITE_API_URL=https://radar-api.onrender.com
```
and **remove `VITE_MOCK_AUTH`** (or set it `false`) so the app uses the real
backend instead of demo data. Then set the backend's `CORS_ORIGIN` to the PWA's
deployed origin.

---

## Moving to migrations later (optional, recommended for a team)

`db push` is fine for a solo/early project. When you want migration history:
```bash
# locally, with DATABASE_URL pointing at a dev DB:
npx prisma migrate dev --name init      # generates prisma/migrations/, commit it
```
Then change the Render build command back to:
```
npm install && npm run build && npm run prisma:deploy
```
(`prisma:deploy` = `prisma migrate deploy`). The extension creation is included in
the generated migration automatically.

---

## Auto-deploys & logs
- Render redeploys on every push to the repo's default branch by default.
- **Logs / Shell / Metrics** are in the service dashboard. The app logs startup as
  `radar-backend listening on :<port> (production)` and handles `SIGTERM` for
  zero-downtime restarts.
