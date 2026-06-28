# syntax=docker/dockerfile:1.7

FROM node:22-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

FROM deps AS build

# Build-time config (Vite bakes import.meta.env at build)
ARG AUTH_MODE=password
ARG PUBLIC_UI_LOCALE=en
ARG INVITE_CODE=
ARG MEASUREMENT_SYSTEM=metric
ARG PUBLIC_DATE_LOCALE=

ENV AUTH_MODE=$AUTH_MODE
ENV PUBLIC_UI_LOCALE=$PUBLIC_UI_LOCALE
ENV INVITE_CODE=$INVITE_CODE
ENV MEASUREMENT_SYSTEM=$MEASUREMENT_SYSTEM
ENV PUBLIC_DATE_LOCALE=$PUBLIC_DATE_LOCALE

COPY . .
RUN npm run build

FROM deps AS pruned-deps
RUN --mount=type=cache,target=/root/.npm \
    npm prune --omit=dev --no-audit --no-fund

FROM node:22-slim AS runtime

WORKDIR /app

COPY --link --from=pruned-deps /app/node_modules ./node_modules
COPY --link package.json ./
COPY --link docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/data
COPY --link --from=build /app/dist ./dist

VOLUME /app/data

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

CMD ["./docker-entrypoint.sh"]
