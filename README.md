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

  Similarity search is done with `prisma.$queryRaw` (see the knowledge-graph
  routes, added in the next build chunk).
- The old Supabase `schedule_insight_review` trigger is replaced by app code:
  creating an insight also creates its `insight_review` row in one transaction.

## API surface

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/signup` · `POST /auth/login` · `PATCH /auth/name` · `PATCH /auth/password` · `DELETE /auth/account` |
| Feed & content | `GET /feed` · `GET /content/:id` · `GET /content` · `GET /topics` · `GET /content/:id/key-moments` _(next chunk)_ |
| Saved / playback / prefs | `GET·POST /saved` · `DELETE /saved/:contentId` · `GET·PUT /playback/:contentId` · `GET·PUT /preferences` _(next chunk)_ |
| Knowledge graph | `POST /insights` · `GET /insights` · `GET /insights/:id/graph` · `POST /insights/links` · `POST /capture` · `POST /insights/:id/share` _(next chunk)_ |
| SRS | `GET /reviews/due` · `GET /reviews/due/count` · `POST /reviews/:id/submit` _(next chunk)_ |
| Quiz & weekly | `GET /insights/:id/quiz` · `POST /insights/:id/quiz/attempt` · `GET /weekly-review` _(next chunk)_ |

All authenticated routes expect `Authorization: Bearer <token>`. Errors are
returned as `{ "error": "message" }` with the appropriate HTTP status.

## Deploy (Render)

`render.yaml` is a blueprint: it provisions the web service + a Postgres and
wires `DATABASE_URL` automatically. Set `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`
in the dashboard (marked `sync: false`).

## Build status

- [x] Schema (all tables ported from `supabase/migrations/`)
- [x] Auth (signup / login / name / password / delete)
- [x] Catalog + per-user routes (feed, content, topics, key-moments, saved, playback, preferences)
- [ ] Knowledge graph + SRS + quiz + weekly review
- [ ] AI pipeline (`/capture`, quiz generation, auto-link embeddings)
- [ ] App rewire (`radar-app` → axios against this API)
