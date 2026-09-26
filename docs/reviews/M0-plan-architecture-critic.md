# M0 plan review: the architecture critic

26 Sep 2026. A fresh architecture critic attacked docs/plans/M0.md for how parallel agents will
build it. "L" = a line of the plan.

## Critical
1. **The scorer cannot match Edison's key by frame IoU:** the key is drafted from PDF pages (half
   rotated) while the export is in DWG model space; the only bridge is ticket 18's registration, the
   pipeline's own output. Fix: match Edison by the key's identity (normalised sheet number, then
   title) and views inside a matched sheet by order and kind; IoU for the Sample Project only.
2. **No export exists for tickets 13, 17, 18 to be scored with** (`engine/export.py` is 21's, wave 5).
   Fix: 06 (or 06a) owns the export and a read → segment → export harness; 21 only switches over.
3. **The owner's check would run agent-written code as the key holder** (ADR 0030 "runs as vxkeys"):
   any PR could read the keys. It also does not fit the sudoers rule (only vx-score as vxkeys). Fix:
   run the pipeline as the owner (or under bwrap with no network and no /home/vxkeys), write the
   export, and run only vx-score as vxkeys.
4. **Ticket 01 deadlocks and is too big:** its engine stubs make it an engine PR needing a
   `real-drawings` status that only 06 can post. Fix: set required checks after 01 merges; split 01
   into 01a (backend, settings, import-linter, pytest/Postgres CI), 01b (web scaffold, tokens, fonts),
   01c (LibreDWG, .NET and not-applicable CI jobs).

## Major
5. **Hidden shared files:** settings (AUTH_USER_MODEL, DB roles, tenant middleware, Procrastinate,
   upload size, TypeSafe), `pyproject.toml`/`uv.lock` (ezdxf, procrastinate, fonttools, pdfplumber,
   pypdfium2), `web/package.json`, the root conftest, NinjaAPI auth/CSRF, `platform/schemas|admin|tasks`,
   03's router and status bar. Fix: 01 pins every M0 dependency and creates `platform.User` with
   AUTH_USER_MODEL; settings, schemas, admin and tasks as packages; name these edits per ticket.
6. **StoredFile and storage have no owner;** wave 3 breaks one-migration-per-module. Fix: in 02 or 07.
7. **Ticket 09's keyed steps and progress need a table** (Procrastinate stores neither); the
   policy-coverage test must allowlist Procrastinate, `django_session`, admin log and contrib tables.
8. **RLS as designed stalls 02:** Membership lookup before the tenant is set (needs an `app.user_id`
   policy); staff creating Developers vs "admin under RLS"; admin LogEntry leaks names; the setup
   role lacks CREATEROLE; a superuser/BYPASSRLS connection passes silently (assert it is not);
   Library rows seeded under forced RLS; cross-tenant API tests need 07/08.
9. **The Trace anchor arrives after its producers:** define `engine/read/anchor.py` and the
   ReadArtefact serialisation in 04; 14 only stores them; 12 blocked by 04.
10. **The real-drawing check's cache must key on the code's hash** too; "up to date with main" forces
    a full rerun per open engine PR per merge. Say what the check reports before 13.
11. **Some `cloud` tickets need the owner's machine:** every engine PR (the status), 10's "agree"
    definition on real files, 04's LibreDWG bug fixes, 21, and the UI tickets' design gate. Label
    them cloud+local and budget the owner's time.
12. **The cloud VM cannot run what the tickets name:** no bubblewrap, no Chrome, `gh release download`
    without a token; GitHub runners block bwrap without a sysctl. Fix: a setup ticket (apt
    bubblewrap and chromium, the app role), CI sets the sysctl, and the runner refuses to run
    unsandboxed outside pytest.
13. **13 and 15 contradict ADR 0011:** Jev picks the sheet type only; code owns storey ranges.
14. **Unowned spec items:** recognising the drawing register; the screen where the MD sees the
    Engineer's act; the browser smoke test; the Step 1 HTTP API; running the worker and the memory
    cap mechanism.
15. **Wave 1 cannot start the day 01 merges:** the owner's checklist, 06 blocked by 05 in the same
    wave, and the Edison key confirmed sheet by sheet. Fix: split 06 (command/harness; Sample key;
    Edison key), sheet-level keys first, view-level before 17.
16. **21 is too big for the stop rule:** split into per-file steps + quarantine; per-sheet steps;
    Proposals, Coverage and the API test.

## Minor
17. The guard refuses staging DWGs: commit the generator only; one fixture file per fixture.
18. The binary buffer contract between Python and TypeScript has no owner: 11 publishes it with a
    committed fixture; 18's renderer fixes are in 11's files.
19. The ezdxf and JSON parses run in the unsandboxed worker, where peak RAM lives: say where.
20. Paths: is `engine` at `vextrus/engine`? `platform/models/*.py` contradicts ADR 0034's anatomy.
21. Doc updates unowned: data-model (Coverage `assigned`, M0 fields, `legend`), CONTEXT "Plot", the
    `real-drawings` skill, ADR 0022, the phone notice.
22. Each rebase reruns full CI: watch the private repo's Actions minutes.
