"""The review bar's path table (S18-F6, re-pinning S17-F6): which files take the 75 bar (lax) and which
the 50 bar (strict). Shared by test_bar.py, test_to_file.py and test_merge_ready.py.

The owner's ruling (7 Oct 2026, session 17): a standing finding blocks at 75, or at 50 on a strict path.
Lesson (e) (PR #610 and PR #615, five review rounds, a missed wall in each): listing the dangerous side
never converged, so STRICT IS THE DEFAULT and a short allowlist is lax. The lax list is exactly:

- the web's view components: a `.tsx` file under `web/src/`, except
  - anything under `web/src/api/` or `web/src/routes/`;
  - any path that names auth or session: the letters `auth` or `session` anywhere in the path below
    `web/src/` (a folder or the file's name, inside a word too, any case: `OAuthButton.tsx`,
    `AuthorBadge.tsx`, `sessions/`). A substring, not a word: a word rule needs a tokenizer that
    `useAuth` or `OAuthButton` would slip through;
  - a test (`*.test.tsx`, anything under `web/src/acceptance/`): a wall's own tests are a wall;
- the docs' Markdown: a `.md` file under `docs/` (never `.json`, `.toml`, `.html` or another extension),
  except the Markdown a script, lint, hook or Claude Code itself reads at run time:
  - `docs/rulings.md` (tools/lint/acceptance_lint.py refuses a pin that contradicts it);
  - `docs/knowledge/lessons.md` (scripts/factory/stamp.py, tools/lint/docs_paths.py);
  - `docs/knowledge/jev-nodes.md` (scripts/factory/jev.py, its pin file);
  - `docs/sdlc.md`, `docs/architecture.md` and `docs/agents/*.md` (tools/lint/docs_paths.py);
  - `docs/design/**` (web/scripts/lint-design-docs.mjs, a CI step of web.yml);
  - a `CLAUDE*.md` or `AGENTS*.md` in any folder (Claude Code loads it as instructions).

Everything else is strict: every other web file (a `.ts`, `web/package.json`, `web/scripts/`,
`web/eslint/`, `web/e2e/`), the root's files, `scripts/`, `tools/`, `vextrus/`, `engine/`, `.claude/`,
`.github/`, a folder nobody listed, and any path that is not a plain relative path.
"""

# A finding of 74 here passes and is filed; one of 75 blocks.
LAX = (
    "web/src/ui/Button.tsx",
    "web/src/members/InviteDialog.tsx",
    "web/src/sheet/SheetViewer.tsx",
    "web/src/components/badge.tsx",
    "docs/adr/0043-reviews-run-by-code.md",
    "docs/research/2d-to-bim-approaches.md",
    "docs/milestones.md",
)

# Inside the lax web/src/*.tsx: walls (the API's transport, the routes, auth and the session, tests).
WEB_CARVED = (
    "web/src/api/client.ts",
    "web/src/api/refusal.ts",
    "web/src/api/Refusal.tsx",
    "web/src/api/forms/Panel.tsx",
    "web/src/routes/_app/route.tsx",
    "web/src/routes/(auth)/sign-in.tsx",
    "web/src/routes/__root.tsx",
    "web/src/auth/SessionWatch.tsx",
    "web/src/auth/Banner.tsx",
    "web/src/app/SessionBanner.tsx",
    "web/src/ui/sessions/List.tsx",
    "web/src/ui/OAuthButton.tsx",
    "web/src/ui/useAuth.tsx",
    "web/src/members/AuthorBadge.tsx",
    "web/src/ui/AUTH/Gate.tsx",
    "web/src/acceptance/t22/step1.test.tsx",
    "web/src/acceptance/ts15w2/Overlay.tsx",
    "web/src/ui/Button.test.tsx",
)

# Inside the lax docs/*.md: the Markdown read at run time, and every other extension.
DOCS_CARVED = (
    "docs/rulings.md",
    "docs/knowledge/lessons.md",
    "docs/knowledge/jev-nodes.md",
    "docs/sdlc.md",
    "docs/architecture.md",
    "docs/agents/domain.md",
    "docs/design/m0-screens.md",
    "docs/design/system.md",
    "docs/plans/CLAUDE.md",
    "docs/specs/AGENTS.md",
    "docs/specs/factory/contracts/walk-verdict.schema.json",
    "docs/specs/factory/contracts/review-verdict.schema.json",
    "docs/knowledge/factory-targets.toml",
    "docs/design/m0-wireframes/step1.html",
    "docs/research/notes.txt",
)

# Off both lax lists: a sample of the strict default.
ELSEWHERE = (
    "web/src/sheet/view.ts",
    "web/src/members/data.ts",
    "web/src/vite-env.d.ts",
    "web/package.json",
    "web/scripts/check-dist.mjs",
    "web/eslint/vextrus.js",
    "web/e2e/acceptance/t22/smoke.spec.ts",
    "web/e2e/fixtures/Page.tsx",
    "web/Page.tsx",
    "web/index.html",
    "CONTEXT.md",
    "README.md",
    "CLAUDE.md",
    "pyproject.toml",
    "scripts/factory/say.py",
    "scripts/ledger.py",
    "scripts/factory/review_tiers.toml",
    "scripts/tests/acceptance/ts17f6/test_bar.py",
    "tools/lint/hook_paths.py",
    "vextrus/rates/table.py",
    "vextrus/platform/migrations/0003_row_level_security.py",
    "engine/read/libredwg/reader.py",
    "engine/assemble/storeys.py",
    ".claude/hooks/guard.mjs",
    ".claude/agents/acceptance-writer.md",
    ".github/workflows/ci.yml",
    "infra/a-folder-nobody-listed/main.tf",
)

# Crafted forms of a lax-looking path: not a plain relative path, or one that lands in a wall.
CRAFTED = (
    "web/src/ui/../api/client.tsx",
    "web/src/ui/../routes/_app/route.tsx",
    "web/../vextrus/rates/table.py",
    "web/src//routes/_app/route.tsx",
    "web/src/./api/Refusal.tsx",
    "web/src/Routes/_app/route.tsx",
    "/web/src/ui/Button.tsx",
    "web\\src\\ui\\Button.tsx",
)

STRICT = WEB_CARVED + DOCS_CARVED + ELSEWHERE + CRAFTED
