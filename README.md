# Radar backend

Custom Node.js API for the Radar app. Replaces the old Supabase data layer:
the Expo app now talks only to this server. Auth is our own JWT (no Firebase,
no Supabase, no Clerk); data lives in a fresh Postgres.

## Stack

- **Express** (TypeScript, CommonJS)
- **Prisma** + **Postgres** (with `pgvector` for knowledge-graph embeddings)
- **JWT** auth (`jsonwebtoken`), **bcryptjs** password hashing
- **zod** request validation

## Local setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL + APP_JWT_SECRET
npm run prisma:migrate        # creates the schema in your Postgres
npm run dev                   # http://localhost:3000
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Database notes

- Needs the `pgvector` and `pgcrypto` extensions. Prisma enables them via the
  `postgresqlExtensions` preview feature on first migrate. Neon and Render
  Postgres both support pgvector.
- The `insight_embedding.embedding` column is `vector(768)`. Prisma can't
  express the HNSW index or vector operators, so after the first migration add
  the index manually (re-runnable):

  ```sql
  CREATE INDEX IF NOT EXISTS insight_embedding_hnsw_idx
    ON insight_embedding USING hnsw (embedding vector_cosine_ops);
  ```

  Similarity search and the embedding write use `prisma.$queryRaw` /
  `$executeRaw` (see `src/services/autolink.ts`). A convenience copy of the
  index lives in `prisma/sql/01_hnsw_index.sql`.
- The old Supabase `schedule_insight_review` trigger is replaced by app code:
  creating an insight also creates its `insight_review` row in one transaction.

## Content ingestion (out of scope here)

The catalog (`content` / `summaries` / `key_moments`) is populated by the old
`ingest-content` Edge Function — a scheduled RSS job, never called by the app.
It is **not** part of this API. Port it later as a standalone cron worker/script
that writes to the same Postgres. Until then, seed catalog rows manually (or via
Prisma Studio) to exercise `/feed` and `/content`.

## API surface

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/signup` · `POST /auth/login` · `PATCH /auth/name` · `PATCH /auth/password` · `DELETE /auth/account` |
| Feed & content | `GET /feed` · `GET /content/:id` · `GET /content` · `GET /topics` · `GET /content/:id/key-moments` |
| Saved / playback / prefs | `GET·POST /saved` · `DELETE /saved/:contentId` · `GET·PUT /playback/:contentId` · `GET·PUT /preferences` |
| Knowledge graph | `POST /insights` · `GET /insights` · `GET /insights/:id/graph` · `POST /insights/links` · `POST /insights/:id/autolink` · `POST /insights/:id/share` |
| SRS | `GET /reviews/due` · `GET /reviews/due/count` · `POST /reviews/:id/submit` |
| Quiz & weekly | `GET /insights/:id/quiz` · `POST /insights/:id/quiz/attempt` · `GET /weekly-review` |
| AI | `POST /capture` (URL → insight preview) |

All authenticated routes expect `Authorization: Bearer <token>`. Errors are
returned as `{ "error": "message" }` with the appropriate HTTP status.

The AI routes (`/capture`, quiz generation inside `GET /insights/:id/quiz`, and
`POST /insights/:id/autolink`) call **Gemini** (`gemini-2.0-flash` +
`text-embedding-004`). They need `GEMINI_API_KEY`; without it they return a clean
`503`. `ANTHROPIC_API_KEY` is reserved for future use — nothing calls it yet.

## Deploy (Render)

`render.yaml` is a blueprint: it provisions the web service + a Postgres and
wires `DATABASE_URL` automatically. Set `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`
in the dashboard (marked `sync: false`).

## Build status

- [x] Schema (all tables ported from `supabase/migrations/`)
- [x] Auth (signup / login / name / password / delete)
- [x] Catalog + per-user routes (feed, content, topics, key-moments, saved, playback, preferences)
- [x] Knowledge graph + SRS + quiz attempts + weekly review
- [x] AI pipeline (`/capture`, quiz generation, auto-link embeddings) — Gemini
- [ ] App rewire (`radar-app` → axios against this API)
- [ ] Content ingestion worker (port `ingest-content` RSS job — separate, optional)
- [ ] App rewire (`radar-app` → axios against this API)
