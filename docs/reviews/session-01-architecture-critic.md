# Session 01 sweep: the architecture critic

26 Sep 2026. A fresh, read-only architecture critic reviewed the architecture, the ADRs and the stack
research before reading the outside plan review. Grilled with the owner; rulings land in the ADRs.

## Findings, ranked
1. **Critical: no sanctioned path from a Confirmation to a quantity to the BOQ.** `takeoff` and
   `measurement` are siblings at layer 4 with no signals or bus (architecture.md:25, :40); a Proposal
   cannot preview its cft; a Rule Set edit silently re-measures or goes stale. Fix: measuring is a pure
   function of (element facts, Rule Set version) in `engine`; `takeoff` previews, `boq` computes on
   read, cached by (model version, Rule Set version); each project pins a Rule Set version and a rule
   edit is an explicit re-measure shown like a Revision Comparison.
2. **Critical: a Trace keyed by handle + bbox cannot point inside blocks** (stack-data.md:120). Exploded
   block entities share one handle across inserts. Fix: anchor = (source sha, reader + version, sheet,
   chain of insert handles, entity handle); never expire an artefact a live Trace references; a test
   resolves every anchor after a re-read.
3. **Major: recognition is not a function of the file,** so reader upgrades orphan in-progress
   Takeoffs. Fix: `recognise` returns candidates plus judgment requests that `takeoff` answers; cache
   key (read-artefact key, hash of confirmed facts, Jev model version); a reader upgrade runs through
   Revision matching from M1.
4. **Major: Proposals and Traces are owned across layers in contradictory ways** (stack-data.md:543,
   :565, :546). Fix (ADR): Proposals live in `takeoff`; `building_model` holds only confirmed states
   with Trace anchors copied in; `drawings` owns only the anchor type.
5. **Major: a Revision is modelled as a whole-set letter,** but sheets are revised one by one. Fix: a
   set state (sheet → revision); element states carry a validity range, written only when changed.
6. **Major: each element family slices through five modules and shared registries,** so parallel
   agents collide (postmortem cause 6). Fix: `engine/families/<family>/` (recognise, check, geometry,
   measure) plus a family row as data, dispatched through a registry generated from the directory.
7. **Major: parallel PRs fork a module's migration chain** with both CIs green. Fix: branches up to
   date before merge; CI `makemigrations --check` and "one leaf per app".
8. **Major: the 3D viewer is rebuilt inside the Confirmation loop;** no edges, caps, isolation or
   budgets. Fix: the client builds RCC extrusions from parametric element JSON per storey; GLB/IFC for
   export and the share link; stencil caps and a batched edge layer; budgets (G+10 first frame ≤3 s,
   orbit ≥50 fps with edges on an integrated-GPU laptop).
9. **Major: dxf-viewer loads the whole model space for each sheet.** Fix: per-sheet render buffers
   clipped from the engine's pass, sheet-local origin; ≤1.5 s to interactive on a cached sheet.
10. **Major: rates in SI break the QS's qty × rate check** (÷ 0.028316846592 does not terminate). Fix:
    Market Prices and rates stored in their quoted unit as exact Decimals; quantity rounded per item in
    its billing unit by a rule; amount = rounded qty × rate; Excel uses formulas; a test to the paisa.
11. **Major: M3–M5 cannot run in parallel;** M5's RLS touches every module. Fix: the app role and RLS
    policies from M0 with the coverage test in CI; M5 only hardens.
12. **Major: long jobs, one read per set, on a shared 8 GB VM;** no fan-out, progress, cancel; a
    restart strands a job. Fix: idempotent per-file then per-sheet steps; a stalled-job retrier; the
    worker in its own container with a memory cap, concurrency 1 on `cad`; measure peak RAM in M0.
13. **Major: staging shares production's RDS instance.** Fix: a separate small instance (~$15/month).
14. **Minor: the "no network" sandbox is unplanned in practice.** Fix: LibreDWG in a sibling container
    with `--network none`, read-only FS, limits; the same in development.
15. **Minor: development is x86_64, the beta's t4g is ARM.** Fix: an arm64 CI job, or x86 beta.
16. **Minor: `--reuse-db` goes stale across branches.** Fix: name the test DB by a migrations hash.

Also missed by the review, unverified: Bangla labels in Bijoy/SutonnyMJ ANSI-mapped fonts read as
Latin garbage whatever renders them; check the Edison set.

## On the outside plan review — disputed
1. M4 junction ownership belongs in a pure function of the pinned Rule Set used by both `measurement`
   and 3D geometry, not in `assemble` alone.
2. M8 "rounding only for display": billing rounds each item before multiplying (finding 10).
3. C5 two decoders on every upload: instead in the local real-drawing gate and on the first file from
   each writer fingerprint, quarantining on disagreement.
4. M12 "counts only": post counts of changed attributes per family from the id-keyed diff.
5. C2 checks are pure functions over (read artefacts, confirmed state), run at read and at every
   Confirmation, not a read-time stage only.
6. M10 engine buffers are right but text, hatches and linetypes become ours: cost as tickets.
7. M3–M5: the larger collision is RLS through every module.
