#!/usr/bin/env bash
# Marca las guías de /ayuda que pueden estar desactualizadas (ver stale-check.mts). Uso: bash src/lib/docs/run-stale.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
root="$(pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp -r src/lib/docs "$tmp/docs"
sed -i -E 's#"@/lib/docs/(articles/[a-z]+|categories|types)"#"./\1.ts"#' "$tmp/docs/index.ts"
DOCS_REPO_ROOT="$root" node --experimental-strip-types --no-warnings "$tmp/docs/stale-check.mts"
