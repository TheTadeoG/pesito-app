#!/usr/bin/env bash
# Prueba de las guías de ayuda (datos + buscador). Node no resuelve el alias "@/", así que se corre sobre una copia
# donde los imports de valores de index.ts pasan a ser relativos. Uso: bash src/lib/docs/run-test.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp -r src/lib/docs "$tmp/docs"
sed -i -E 's#"@/lib/docs/(articles/[a-z]+|categories|types)"#"./\1.ts"#' "$tmp/docs/index.ts"
DOCS_PUBLIC="$(pwd)/public/ayuda" node --experimental-strip-types --no-warnings "$tmp/docs/docs.test.mts"
