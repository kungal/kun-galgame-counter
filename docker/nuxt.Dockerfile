#
# kun-galgame-counter — the "down for maintenance" page + tiny vote counter.
#
# A single, self-contained Nuxt 4 SSR app (Nitro node-server preset). Unlike the
# kungal/moyu frontends this is NOT a workspace and consumes no `packages/ui`
# layer, so the build is the plain single-package shape: install from the
# lockfile, copy source, `nuxt build`, ship only Node + the self-contained
# `.output`.
#
# There is no public runtime config to bake (no API/OAuth/image bases) — the
# only knob is COUNTER_IP_SALT, read at RUNTIME by the server route, so it is
# NOT a build arg. See docker/README.md.
ARG NODE_VERSION=24
# Default listen port baked into the image. Overridden at runtime by NITRO_PORT
# (the compose files set it from WEB_PORT in .env — the single source of truth).
ARG PORT=2326

FROM node:${NODE_VERSION}-trixie-slim AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install from the lockfile only (cached until the lockfile moves) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts: the `postinstall: nuxt prepare` can't run here (app source
# isn't copied yet); the build stage's `nuxt build` runs prepare itself.
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- build: produce the self-contained .output ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- run: just Node + .output (no pnpm, no sources) ----
FROM node:${NODE_VERSION}-trixie-slim AS run
ARG PORT
ENV NODE_ENV=production HOST=0.0.0.0 NITRO_PORT=${PORT}
WORKDIR /app
COPY --from=build /app/.output ./.output
# Votes are persisted to <cwd>/server/data/counter.json (counter.ts), which the
# Nitro .output does NOT bundle. Pre-create the dir owned by `node` so a mounted
# named volume inherits write access — without the volume, votes reset on every
# redeploy. See the `counter-data` volume in the compose files.
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data
USER node
EXPOSE ${PORT}
CMD ["node", ".output/server/index.mjs"]
