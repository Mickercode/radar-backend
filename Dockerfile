# ── Stage 1: build ─────────────────────────────────────────────────────────────
# Full install (all deps are in "dependencies" since Render needed them there),
# generate the Prisma client, then compile TypeScript.
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

COPY tsconfig.json .
COPY src ./src/
RUN ./node_modules/.bin/tsc -p tsconfig.json

# ── Stage 2: runtime ───────────────────────────────────────────────────────────
# Re-install on the target platform so Prisma's native binaries match Alpine,
# then copy compiled output from the builder stage.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# Alpine 3.17+ ships OpenSSL 3, not 1.1 — point Prisma at the correct engine after generate
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

COPY --from=builder /app/dist ./dist/

EXPOSE 3000
CMD ["node", "dist/server.js"]
