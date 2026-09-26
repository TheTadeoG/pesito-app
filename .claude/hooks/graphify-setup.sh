#!/usr/bin/env bash
# Al empezar una sesión: instala el CLI de Graphify si falta y regenera el
# mapa del código (graphify-out/, no se commitea). Corre en segundo plano
# para no demorar el arranque; tarda ~30 s la primera vez.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
export PATH="$HOME/.local/bin:$PATH"
(
  if ! command -v graphify >/dev/null 2>&1; then
    command -v uv >/dev/null 2>&1 || pip install --user -q uv >/dev/null 2>&1
    uv tool install -q "graphifyy[sql]" >/dev/null 2>&1
  fi
  graphify update . >/dev/null 2>&1
) >/dev/null 2>&1 &
exit 0
