#!/usr/bin/env bash
# Bring the product up from this checkout, as the investors will see it. Ports: SPRINT_API_PORT
# (default 8000) and SPRINT_WEB_PORT (default 5410). Stop with Ctrl-C.
set -euo pipefail
API=${SPRINT_API_PORT:-8000}
WEB=${SPRINT_WEB_PORT:-5410}
export VEXTRUS_DEBUG=1 VEXTRUS_API_ORIGIN="http://127.0.0.1:$API"
uv run manage.py ensure_database
uv run manage.py migrate --noinput
uv run manage.py seed_demo
trap 'kill 0' EXIT
uv run manage.py worker &
uv run manage.py worker --queue cad &
uv run manage.py runserver "127.0.0.1:$API" &
npm --prefix web run dev -- --port "$WEB" &
echo "Vextrus: http://127.0.0.1:$WEB  (API http://127.0.0.1:$API/api/)"
wait
