#!/usr/bin/env bash
# THE CRAFT TABLE (AM-08 Part 2): every screen of a measured J-000 project, walked with the run's own
# cookies at both themes and both viewports, one verdict line each. The score is the minimum over
# the four captures; the bar is >= 4.0 with no criterion below 3 (Direction §7).
#
#   bash scripts/probe/craft-walk.sh test-results/j-000-golden-run.dark.w<N>.json test-results/probe/craft
#
# The run file is what `pnpm e2e --journeys J-000` leaves behind (pick one with "measured": true);
# the probe's server must be up (`pnpm probe:server`). The drawing and the set are read off the
# journeys' database by id — the psql reads are filtered to a uuid because psql echoes `SET` for the
# reason clause it is handed, and that echo once landed in the ids (session 3).
#
# Outputs go under the given directory: `verdicts.txt` (one line per capture), a JSON and a picture
# per route/theme/viewport. Never committed — the run file holds the session's cookies.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RUN="${1:?usage: craft-walk.sh <j-000-golden-run.json> <out-dir>}"
OUT="${2:?usage: craft-walk.sh <j-000-golden-run.json> <out-dir>}"
mkdir -p "$OUT"
TENANT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tenantId)' "$RUN")
PROJECT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).projectId)' "$RUN")
node -e 'process.stdout.write(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).cookies))' "$RUN" > "$OUT/cookies.json"
DB="${PROBE_DATABASE_URL:-postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_e2e}"
DRAWING=$(psql "$DB" -Atq -c "set cubit.system_reason='probe read';" -c "select drawing_id from drawings where tenant_id='$TENANT' and project_id='$PROJECT' order by drawing_id limit 1;" | grep -E '^[0-9a-f-]{36}$' | head -1 || true)
SET=$(psql "$DB" -Atq -c "set cubit.system_reason='probe read';" -c "select set_id from drawing_sets where tenant_id='$TENANT' and project_id='$PROJECT' order by created_at limit 1;" | grep -E '^[0-9a-f-]{36}$' | head -1 || true)
SHEET="${PROBE_SHEET:-FOUNDATION PLAN}"
P="/t/$TENANT/p/$PROJECT"
echo "tenant=$TENANT project=$PROJECT drawing=${DRAWING:-none} set=${SET:-none}"
: > "$OUT/verdicts.txt"
COMMON=(--cookies "$OUT/cookies.json" --themes dark,light --viewports 1440x900,1280x800 --shot --out "$OUT")

walk() { node "$HERE/probe.mjs" walk "${COMMON[@]}" "$@" 2>&1 | grep -E "^(OK |RED)" | tee -a "$OUT/verdicts.txt"; }

# The eighteen screens of the craft table (session-3 handoff §4), in the order a reader meets them.
walk "/t/$TENANT"
walk "$P"
walk "$P/drawings"
walk "$P/drawings/sets"
if [ -n "$SET" ]; then walk "$P/drawings/sets/$SET"; fi
if [ -n "$DRAWING" ]; then walk --kind canvas "$P/viewer/$DRAWING/$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$SHEET")"; fi
walk "$P/takeoff/register"
walk "$P/takeoff/coverage"
walk "$P/takeoff/levels"
walk "$P/takeoff/schedules"
walk "$P/takeoff/boq"
walk "$P/takeoff/bbs"
walk "$P/documents"
walk "$P/audit"
walk "$P/settings/ruleset"
walk "$P/settings/participants"
walk "$P/settings/site-facts"
walk "$P/settings/ruleset-author"

# The table: one row per route, the minimum total and minimum criterion over the four captures.
node - "$OUT" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");
const out = process.argv[2];
const rows = new Map();
for (const file of fs.readdirSync(out).filter((f) => f.endsWith(".json") && f !== "cookies.json")) {
  let json;
  try { json = JSON.parse(fs.readFileSync(path.join(out, file), "utf8")); } catch { continue; }
  if (!json || !json.craft || !json.route) continue;
  const held = rows.get(json.route) ?? { total: Infinity, min: Infinity, below: new Map(), state: json.rendered?.rootState ?? json.state ?? null };
  held.total = Math.min(held.total, json.craft.total);
  held.min = Math.min(held.min, json.craft.min);
  for (const [name, c] of Object.entries(json.craft.criteria)) if (c.score < 3) held.below.set(name, Math.min(held.below.get(name) ?? 5, c.score));
  rows.set(json.route, held);
}
const lines = ["| Route | total | min | below 3 | Verdict |", "|---|---|---|---|---|"];
for (const [route, r] of rows) {
  const below = [...r.below].map(([n, s]) => `${n} = ${s}`).join(", ") || "—";
  lines.push(`| ${route.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (m) => m.slice(0, 8))} | ${r.total.toFixed(2)} | ${r.min} | ${below} | ${r.total >= 4 && r.min >= 3 ? "OK" : "RED"} |`);
}
fs.writeFileSync(path.join(out, "craft-table.md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
EOF
