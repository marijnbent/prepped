#!/bin/sh
set -eu

echo "Applying database migrations..."
node ./scripts/migrate-runtime.mjs

echo "Starting server..."
exec node ./dist/server/entry.mjs
