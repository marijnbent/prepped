#!/bin/sh
set -e

echo "Running drizzle-kit push..."
npx drizzle-kit push --force

echo "Starting server..."
exec node ./dist/server/entry.mjs
