#!/bin/sh
set -eu

node ./scripts/check-db-safety.mjs

echo "Starting server..."
exec node ./dist/server/entry.mjs
