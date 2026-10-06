# The cloud environment `vextrus`: the owner's checklist

The cloud sessions run in one environment, `vextrus`. Its setup script builds the toolchain once (the
result is cached for about 7 days); each session's start hook then starts PostgreSQL 18 and makes any
role or database that is missing. Do these steps in claude.ai, in the environment's settings, on each
Claude account that runs cloud sessions. Nothing here holds a password: you choose the two database
passwords, and they live only in the environment's variables.

## Steps

1. [ ] **Setup script.** Open the environment `vextrus`, then its **Setup script** box, and paste the
   whole contents of `scripts/cloud/setup.sh` (it reads `scripts/cloud/postgres.sh`,
   `scripts/owner/db-roles.sql` and `toolchain/` from the clone). Paste it again after any change to
   those files or to a pin in `toolchain/`: a changed script rebuilds the cache.
2. [ ] **Network access.** Set the level to **Custom**, tick "Also include default list of common
   package managers", and add every host the scripts fetch from that the default list may lack:
   - `releases.astral.sh` (uv)
   - `ftp.gnu.org` (LibreDWG's source, the fallback build)
   - `apt.postgresql.org` (PostgreSQL 18)
   - `builds.dotnet.microsoft.com`, `dot.net`, `ci.dot.net` (the .NET SDK)
   - `cdn.playwright.dev`, `playwright.download.prss.microsoft.com` (Chromium for the web's tests)
   - `nodejs.org` (Node 24)
   - `api.github.com`, `github.com`, `codeload.github.com`, `objects.githubusercontent.com`,
     `release-assets.githubusercontent.com` (the toolchain release; the session's GitHub proxy
     usually reaches these already)
3. [ ] **Variables.** Add these as environment variables. Pick two different throwaway passwords; they
   are valid only inside the VM. The setup and every session start give the roles `vextrus` and
   `vextrus_app` the passwords these two URLs name, so the URLs and the roles never disagree.
   - `DATABASE_URL` = `postgresql://vextrus_app:<app-password>@127.0.0.1:5432/vextrus`
   - `DATABASE_OWNER_URL` = `postgresql://vextrus:<owner-password>@127.0.0.1:5432/vextrus`
   - `UV_PYTHON_INSTALL_DIR` = `/opt/vextrus/python`
   - `UV_PYTHON_PREFERENCE` = `only-managed`
   - `TYPESAFE_API_KEY` = `proxy-injected` (the real key stays with the proxy: ADR 0013)
   - `VEXTRUS_RELEASE_TOKEN` is optional and not needed.
4. [ ] **Save, then start a fresh cloud session** (a saved change builds the cache on the next start,
   so that first start is the slow one). The session's start prints the setup's status.
5. [ ] **Check the 5-minute budget.** The setup must finish within five minutes (300 s). Read the last
   line of the status the session start prints: `total: <N>s (budget 300s)`; the same text is in
   `/opt/vextrus-setup.status`, and each piece's timing and log path are above it. Over 300 s, or any
   piece `FAILED`: tell the orchestrator, with the status text. The status also shows `id -u`, the
   user the setup ran as; the PostgreSQL step assumes root, so a non-zero value is worth reporting.
6. [ ] **Check the database.** The session start prints no `WARN: PostgreSQL 18 did not start` and no
   `WARN: the database roles are not ready`. Both roles log in with the passwords you chose.
7. [ ] **Browser walks are local-only.** A cloud session has no chrome-devtools browser. It says so at
   its start, and the agents report a walk as not done; they never fall back to a Playwright walk.
   Walk the running product on your own machine, or in a local session.

## Check the scripts without a cloud

`VEXTRUS_CLOUD_DRY_RUN=1 bash scripts/cloud/setup.sh` runs the PostgreSQL part against the PostgreSQL
tools on your PATH, as you, downloads and installs nothing, and prints `id -u` and the elapsed seconds.
The committed acceptance tests under `scripts/tests/acceptance/ts14c1` run both scripts that way
against stand-in tools.

## What is not measured

The 5-minute budget and a run as uid 0 have not been measured in a real cloud session since these
scripts changed; steps 4 to 6 are how you measure them. The research behind the layout is
`docs/research/sdlc-waves-and-cloud.md`.
