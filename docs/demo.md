# The demo — the Takeoff module on the owner's screen

One command serves the product, showing the newest measured M3 project, to a browser on this
machine and prints how to sign in. The owner's ruling (session 7): the demo is shown **on my
screen**. It runs on 127.0.0.1 only, on a port of its own so it never holds the journeys' port. No
LAN exposure, and the firewall stays as it is.

**No journey may run while the demo stands.** The demo runs the shipped worker, so Measure and
"Draft the bill" work in front of the owner. That worker takes jobs from **every tenant** in
`cubit_e2e`, the journeys' own database, so beside a journey run it would take that run's jobs.
`pnpm demo` refuses to start while the journeys' port is held. The reverse is yours to keep: stop
the demo (`pnpm demo --stop`) before any `pnpm e2e`, `pnpm test:perf` or the gate.

```bash
pnpm demo              # find the project, prove its sign-in, serve, print one block, open the browser
pnpm demo --no-open    # the same, without opening a browser
pnpm demo --stop       # stop what `pnpm demo` started in this checkout, and nothing else
```

## The founder's script (session 9 — walked in the browser, walk-3)

Tell the story on the **pre-measured Bashundhara G+6 project** (`pnpm demo` opens it), and set up a
fresh project the day before if you want to show the set-up steps live. Start the demo from a terminal
where `TYPESAFE_API_KEY` is set (`~/.bashrc`): Ask then answers from Jev live, and the AI spend the
project home shows is the product's own model ledger — true to the cent. Walked at 1440x900 dark
(Settings sets the theme; it does not follow the OS).

**1. The drawings come in (on a fresh project, prepared beforehand or live).**
- Projects → New project → Name, Client, District → choose a **Building type first** → Create project
  → open the new row. *(Avoid: submitting without a building type clears the form.)*
- Add drawings → Choose files → `rcc6-bnbc.dwg`. The audience sees "Read the drawing — Done" and 28
  sheet cards.
- Preview this group → "28 sheets from Unassigned to Structural" → Confirm.
- Drawing sets → name "Structural IFC" → Create set → Add → Preview this pin → Confirm.

**2. Scale and the first Measure — the product says what it cannot do yet.**
- Takeoff → Measure this campaign → "This run published no line", and each view that has no scale of
  record is listed with its reason and **Open the sheet**. This is the honesty story: nothing is
  guessed.
- Open the sheet (COLUMN LAYOUT PLAN) → Scale → include the view → Affirm at Dimension ratio → Confirm.
- Proposed level stacks → Preview this group → Confirm → Measure → "Open the levels" → state the
  typical range GF–6F → Confirm → Measure → the columns publish. *(Show S-10 only; each other view
  needs its own scale act.)*

**3. The machine's takeoff (switch to the measured Bashundhara G+6).**
- Register: ~1,600 lines, each with its basis, coverage, source and formula. Column concrete
  93.893 m³ (208 lines); piles 372.849 m³; pile caps 122.464 m³ net of the pile heads and the lift-pit
  recess; column rebar with its ties.
- **The Trace**: Level · GF → click a column line's source → the viewer opens S-10 on that column; the
  inspector shows V = count × L × B × H with L and B linked to S-11's schedule and H to S-25's section.
  *(It lands close: press − three times to show the grid.)* ⌘K "C2" does the same from the palette.

**4. What is and is not measured.**
- Levels and Schedules → S-01's notes: 3,500 psi for all members, 3,000 psi for the bored piles.
- Coverage: the class × level matrix and the certificate preview — every cell says why it stands as it
  does ("Beam drawn, not named", "Not placed", "Ties of 34 members not counted — joint unread").

**5. A QS measures what the machine could not.**
- S-08 → New condition (Area · Slab · Blinding, 75) → Save → click the slab's corners → Enter → the
  card reads "Adds 1 line: GF slab blinding …" → Confirm. The line is in the register and the draft BOQ.

**6. Ask the drawings.**
- "How many C1 columns are on the ground floor?" → 3. "How much column concrete is there in total?"
  → 93.893 m³ from 208 lines. "What will the building cost?" → an honest refusal pointing to the draft
  BOQ. Every figure links back to the members it counts.

**7. The documents.**
- Draft BOQ → Export the draft → Open the issued draft: one item per description, a drawing register,
  measurement notes, the sign-off block, and what is not measured with its reason.
- Bar schedule → Export the schedule: bars and ties by floor, each mark once with its member count,
  the total saying exactly what it covers.

**Keep out of the demo for now** (walk-3; being fixed in wave 3e): scaling a **scanned** sheet;
**finishes** on the architect's set (rooms are detected and confirmed, finish quantities do not yet
follow); clicking the **Trace of a hand-measured line** (it lands on the snapped line). A **PDF** set
reads and scales but registers no structural members: show it as reading, not takeoff.

## What it shows

The takeoff register of the newest **"Bashundhara G+6"** project in the journeys' database
(`cubit_e2e`). That is F-RCC6-BNBC, the M3 yardstick, as J-000's M3 legs uploaded, transcribed and
measured it. "Measured" means that the project's newest campaign published COMPLETE column concrete
lines (`column` × `rcc.concrete`). The demo **prefers** a project that is also *billed*, meaning it has
a live issued bill of quantities (`boq-draft`) and bar rows from the bill leg. If no project is
billed, it takes the newest one that is only measured. The printed block says which kind it
found. It takes only a project that was made by J-000's legs account and whose drawings are in
**this checkout's** store (`storage/<tenant>/`). A project a worktree's run made has its drawings in
that worktree, and its sheets would answer "the store holds no object".

## The prerequisite

A J-000 run that walks the M3 legs, from this checkout:

```bash
pnpm e2e --journeys J-000
```

A measured M3 project exists in `cubit_e2e` only after such a run. Each leg file walks its own BNBC
project, per worker. The database keeps every earlier run, so a project made yesterday still serves
today.

Run the demo from the main checkout. An agent's worktree links `node_modules` to the main
checkout's, and Turbopack refuses to build through a `node_modules` that points outside the project
root. In that case the demo's build fails and the demo says so: `FAIL demo — the served product
exited before it answered`. Where the drawings live elsewhere, `STORAGE_ROOT` names that store,
exactly as it does for the journeys.

## The sign-in

J-000's legs sign up as `j000-legs-<stamp>@cubit.test` with the password `golden-path-legs-<stamp>`
(`tests/e2e/journeys/j-000/golden-run.ts`). The run file that records the address is deleted by the
next Playwright run, so the demo reads the address from the database instead. It unfolds the stored
key through the product's own `presentedValue`, derives the password, and **proves** it against the
stored hash with the product's own `verifyPassword` before anything is served. The hash is never
printed. The password is a derivable test credential of a journey account, not a secret, and it is
printed once, in the final block.

The register address first sends you to sign in. After you sign in, the product lands on its home and
keeps no return path, so open the register address again.

## What you see

```
demo: project <project> — billed (1 billed of 11 measured, 41 "Bashundhara G+6" in cubit_e2e); sign-in proved against the stored hash
demo: serving the built product — .next-cubit built 443s ago and every input is older; log …/node_modules/.cache/cubit/demo/server.log
demo: served at http://127.0.0.1:3213; worker: ready (pid 412716); log …/node_modules/.cache/cubit/demo/worker.log
──────────────────────────────────────────────────────────────────────────────
DEMO ready — Vextrus Cubit at http://127.0.0.1:3213 (127.0.0.1 only; nothing listens beyond this machine)

  Project   Bashundhara G+6 — measured and billed — 182 column concrete lines, an issued bill of quantities, 182 bar rows
            made 2026-09-23T04:29:31.340461+06:00 by J-000's M3 legs
  Open      http://127.0.0.1:3213/t/<tenant>/p/<project>/takeoff/register
  Sign in   j000-legs-<stamp>@cubit.test
  Password  golden-path-legs-<stamp>
            The address asks you to sign in first and then lands on the product's home: open it again.
  Worker    ready — it takes jobs from every tenant in cubit_e2e: run no journey while the demo stands
  Stop      pnpm demo --stop

  Browser   opened in your Windows browser
──────────────────────────────────────────────────────────────────────────────
```

When no project is billed yet, the Project line reads `measured only — 182 column concrete lines;
no issued bill with bar rows yet (the bill leg has not run on it)`.

The browser is opened with `cmd.exe /c start "" <url>`, run from `/mnt/c`. Where
`/mnt/c/Windows/System32/cmd.exe` is absent (not WSL, or CI), the block says so, and you paste the
address into a browser yourself.

## Networking: WSL2 mirrored

This box runs WSL2 with **mirrored** networking. A Windows browser reaches a WSL listener on
`http://127.0.0.1:<port>` directly, so no relay and no firewall rule is needed. Two rules:

- **Use 127.0.0.1, never `localhost`.** Windows tries `::1` first (0.21 s against 0.004 s per
  connection), and the product binds only 127.0.0.1. The demo prints 127.0.0.1.
- **`netsh interface portproxy show all` must print nothing.** Run it in a Windows shell. Under
  mirrored networking, a leftover portproxy rule holds the port on the Windows side, where Linux's
  `ss` cannot see it. The demo then refuses: `port … is held (not visible to ss — held outside Linux …)`.

The port is 3213. `scripts/lib/ports.mjs` is its one home, and `DEMO_PORT` moves it.

## Stopping

```bash
pnpm demo --stop
```

This stops the served product and the worker, and nothing else: only what `pnpm demo` recorded in
this checkout. Its record is `node_modules/.cache/cubit/demo/stage.json`, and each recorded process
group is signalled only while its leader still runs the stage's own script. The probe keeps its
own record (`scripts/probe/server.pids`), so `pnpm probe:server --stop` never takes the demo down,
and `pnpm demo --stop` never takes the probe down. The logs are
`node_modules/.cache/cubit/demo/server.log` and `worker.log` beside it.

## What not to run beside it

**No journey, while the demo stands.** The demo's worker takes jobs from every tenant in
`cubit_e2e`, so `pnpm e2e` (any journey), `pnpm test:perf` and the gate's served lanes would have
their jobs taken and run by the demo's worker. `pnpm demo` refuses to start while the journeys'
port is held; stop the demo before you run any of them.

The demo serves **the journeys' own build** (`.next-cubit`). It reuses that build when it is
current, and builds it first when it is stale, which takes a minute or two. It never builds under
another server: if a journey run or the probe **in this checkout** is serving `.next-cubit`, the demo
refuses by name, and you start it again once that server has ended. In the same checkout, while the
demo is up:

- **`pnpm verify`** (and the gate, which starts with it). Its build lane always runs `next build`
  into `.next-cubit`, which deletes and rewrites the bundle the demo is serving. The demo then
  answers errors until you run `pnpm demo --stop` and `pnpm demo` again. It cannot make a lane walk
  a wrong build.
- **`pnpm probe:server`** is not a lane, so it refuses: when `.next-cubit` must be rebuilt and the
  demo (or any other live server) serves from it, it stops with a `REFUSE probe:server` line naming
  the server. Each server holds the build under its own lock (`.next-cubit/.e2e-server.lock.<pid>`),
  so neither one's end releases the other's hold, and `pnpm e2e:clean --all` keeps the directory
  while either serves.
- **`pnpm test:db` and the gate's db lane.** The gate refuses the db lane while the demo's port is
  held (V-DB: a served product and the lane's template copies share one cluster). Stop the demo
  before you run it.
