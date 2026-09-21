#!/usr/bin/env bash
# The two routes craft-walk.sh mis-spelled (psql's "SET" echo landed in the ids): the set browser
# and the viewer. Usage: bash craft-walk-2.sh <j-000-golden-run.dark.wN.json> <out-dir>
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RUN="$1"; OUT="$2"; mkdir -p "$OUT"
TENANT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenantId)' "$RUN")
PROJECT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).projectId)' "$RUN")
node -e 'process.stdout.write(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).cookies))' "$RUN" > "$OUT/cookies.json"
DB="postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_e2e"
DRAWING=$(psql "$DB" -Atq -c "set cubit.system_reason='probe read';" -c "select drawing_id from drawings where tenant_id='$TENANT' and project_id='$PROJECT' order by drawing_id limit 1;" | grep -E '^[0-9a-f-]{36}$' | head -1)
SET=$(psql "$DB" -Atq -c "set cubit.system_reason='probe read';" -c "select set_id from drawing_sets where tenant_id='$TENANT' and project_id='$PROJECT' order by created_at limit 1;" | grep -E '^[0-9a-f-]{36}$' | head -1)
P="/t/$TENANT/p/$PROJECT"
echo "tenant=$TENANT project=$PROJECT drawing=$DRAWING set=$SET"
COMMON=(--cookies "$OUT/cookies.json" --themes dark,light --viewports 1440x900,1280x800 --shot --out "$OUT")
if [ -n "$SET" ]; then node "$HERE/probe.mjs" walk "${COMMON[@]}" "$P/drawings/sets/$SET" 2>&1 | grep -E "^(OK |RED)" | tee -a "$OUT/verdicts.txt"; fi
if [ -n "$DRAWING" ]; then node "$HERE/probe.mjs" walk "${COMMON[@]}" --kind canvas "$P/viewer/$DRAWING/FOUNDATION%20PLAN" 2>&1 | grep -E "^(OK |RED)" | tee -a "$OUT/verdicts.txt"; fi
