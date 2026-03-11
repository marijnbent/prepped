#!/bin/sh
set -eu

echo "Starting server..."
exec node ./dist/server/entry.mjs
