FROM node:22-slim AS base

# Install dependencies for sharp and better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

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

# Data directory for SQLite + uploads
RUN mkdir -p /app/data
VOLUME /app/data

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
