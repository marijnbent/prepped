FROM node:22-slim AS base

# Install dependencies for sharp and better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

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

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

# Drizzle needs config + schema to run push
COPY --from=base /app/drizzle.config.ts ./
COPY --from=base /app/src/lib/schema.ts ./src/lib/schema.ts

# Entrypoint runs drizzle-kit push then starts the server
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Data directory for SQLite + uploads
RUN mkdir -p /app/data
VOLUME /app/data

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

CMD ["./docker-entrypoint.sh"]
