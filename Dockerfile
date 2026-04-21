# syntax=docker/dockerfile:1.7
# Bot Boss — backend container.
# Build:  docker build -t botboss-server .
# Run:    docker run --rm -p 3000:3000 --env-file .env botboss-server

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

# ─── Install deps (includes dev for build) ────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ─── Build: transpile server → dist/ ──────────────────────────────────────
FROM deps AS build
COPY tsconfig.json ./
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle
RUN pnpm build

# ─── Runtime: prod deps only + compiled output ────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

# Drop privileges.
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
