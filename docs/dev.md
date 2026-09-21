# Vextrus Cubit — Local Development Lane Runbook (ARCH-02, C-06; docs/decisions/dev-lane.md)

The local development lane provides an isolated, deterministic native-Postgres development environment supervised by `pnpm dev`. It provisions and migrates the database, seeds the founder account and F-RCC6 SAMPLE project, and runs the web app and background worker without interfering with `pnpm verify`, `pnpm test:db`, `pnpm e2e`, or `vextrus-builder`.

---

## 1. Quickstart

```bash
# 1. Run checkup to verify machine tools and services
pnpm checkup

# 2. Start the supervised development server
pnpm dev
```

Visit **`http://127.0.0.1:3210`** in your browser.

---

## 2. Seed Identities & Credentials

The development lane deterministically provisions canonical seed entities:

| Entity | Identifier / Value | Details |
|---|---|---|
| **Founder Email** | `founder@cubit.dev` | Stored via scrypt `N=32768`, `r=8`, `p=1` |
| **Founder Password**| `cubit-dev-founder-password` | Development authentication secret |
| **User ID** | `d3e00000-0000-4000-8000-000000000003` | Canonical UUID |
| **Workspace (Tenant)**| `Founder Works` (`d3e00000-0000-4000-8000-000000000001`) | OWNER role |
| **Sample Project** | `SAMPLE: six-storey RCC residential building` (`SAMPLE-RCC6`) | Seeded from `scripts-data/sample-seed/manifest.json` |

---

## 3. Commands & Options

### `pnpm dev`
Starts the supervised development lane on port `3210`.

```bash
# Default start (http://127.0.0.1:3210 with worker)
pnpm dev

# Custom port
pnpm dev --port 3220

# Bind to 0.0.0.0 with WSL2 address resolution and portproxy hint
pnpm dev --host

# Web tier only (skip background worker)
pnpm dev --no-worker

# Reset dev database and re-seed from scratch
pnpm dev --reset
```

**Port conflict guarantee:** If the target port is occupied, `pnpm dev` refuses to start and identifies the occupying PID. It never silently binds an unexpected port.

### `pnpm seed`
Runs idempotent seeding on the database targeted by `DATABASE_URL`.

```bash
DATABASE_URL=postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_dev pnpm seed

# Reset seed rows before inserting
DATABASE_URL=postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_dev pnpm seed --reset
```

### `pnpm dev:clean`
Purges development artifacts while ensuring running servers are never disrupted.

```bash
pnpm dev:clean
```
- Refuses to run if a dev server is currently holding the `.next-dev` lock.
- Drops the `cubit_dev` database.
- Removes `.next-dev` and `storage/dev`.
- Leaves `.next-cubit`, test databases, and production storage untouched.

### `pnpm checkup`
Probes system tools, ports, migration head, and environment definitions:
```bash
pnpm checkup
```
Verifies that:
- Node and pnpm match pins in `.nvmrc` and `package.json`.
- Postgres is reachable and roles `cubit_migrate` and `cubit_app` exist.
- `cubit_dev` exists and is migrated to the latest migration head.
- `storage/dev` is present and writable.
- `.env.example` declares all seven runtime environment variables.

---

## 4. Isolation Guarantees

The development lane is architecturally isolated from testing and build lanes:

| Dimension | Dev Lane (`pnpm dev`) | Testing Lanes (`verify`, `test:db`, `e2e`) |
|---|---|---|
| **Database** | `cubit_dev` | Isolated scratch databases (`cubit_dbtest_*`, `cubit_e2e`) |
| **Build Directory** | `.next-dev` | `.next-cubit` (locked by `next build`) |
| **Storage Root** | `storage/dev` | `storage/` or test temporary directories |
| **Lockfile** | `.next-dev/.dev-server.lock` | `<distDir>/.e2e-server.lock` |
| **App Port** | `3210` | `3211` (e2e server) |
| **Worker Port** | `3212` | Ephemeral test ports |

---

## 5. WSL2 Reachability & Windows Browser Access

### Localhost Forwarding (Default)
When running inside WSL2 on Windows 10/11:
- `pnpm dev` binds to `127.0.0.1:3210`.
- WSL2's built-in localhost forwarding automatically forwards traffic from Windows host browsers (Edge, Chrome, Firefox) to `http://127.0.0.1:3210`.

### External Host Mode (`--host`)
To expose the development server to other machines on the local network:
```bash
pnpm dev --host
```
`pnpm dev` binds to `0.0.0.0`, discovers your WSL2 virtual Ethernet IPv4 address, and prints the exact port-forwarding command to run in an **elevated Windows PowerShell**:

```powershell
netsh interface portproxy add v4tov4 listenport=3210 listenaddress=0.0.0.0 connectport=3210 connectaddress=<WSL_IP>
```
