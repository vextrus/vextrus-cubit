# The engine and the data spine: pure measuring, precise Traces, families as packages

From the architecture critic's sweep (docs/reviews/session-01-architecture-critic.md, #1–#7 and
#12–#16), adopted as one bundle:
1. **Measuring is a pure function of (confirmed element facts, Rule Set version)** in `engine`.
   `takeoff` previews it on Proposals ("86 columns = 1,240 cft"); `boq` computes on read, cached by
   (model version, Rule Set version). Each project pins a Rule Set version; a rule edit is an explicit
   re-measure, shown split like any comparison (ADR 0028).
2. **A Trace anchor** is (source file hash, reader and version, sheet, chain of insert handles, entity
   handle) for a DWG, and (page, path index, box) for a PDF. A derived artefact is never expired while
   a Trace references it; a test resolves every anchor after a re-read.
3. **`recognise` returns candidates plus judgement requests,** which `takeoff` answers (Jev or the
   QS). Its cache key is (read-artefact key, hash of confirmed facts, Jev model version); a reader
   upgrade runs through Revision matching (ADR 0015).
4. **Ownership:** Proposals and candidate geometry live in `takeoff`; `building_model` holds only
   confirmed elements, confirmed reinforcement included, with Trace anchors copied in by the confirm
   service; `drawings` owns only the anchor type.
5. **Element families are packages:** `engine/families/<family>/` (recognise, check, geometry,
   measure) plus a family row as data, dispatched through a registry generated from the directory. A
   family ticket only adds files.
6. **Migrations:** CI runs `makemigrations --check` and asserts one leaf per module; test databases
   are named by a hash of the migration files.
7. **Jobs:** reading runs as idempotent steps per file, then per sheet, with progress and cancel; a
   periodic retrier picks up stalled jobs; the CAD worker has its own memory cap and concurrency 1 on
   its queue; peak RAM on the Edison set is measured in M0.
8. **Sandboxing:** the DWG readers run with no network and a read-only filesystem, via `bwrap`
   natively in development and a locked-down sibling container in the beta; tested in M0.
9. **The beta runs on x86 instances,** matching development and CI (amends ADR 0023's t4g).
10. **Staging has its own small database** (about $15 a month).
11. **An upload Check flags Bangla text in legacy ANSI fonts** (Bijoy/SutonnyMJ).

Why: each removes a failure that would otherwise appear mid-build: a Confirmation with no sanctioned
path to the BOQ, Traces that cannot name one door in a block, reader upgrades that orphan the QS's
work, parallel tickets colliding on shared registries or migration chains, a restart stranding a
job, a sandbox first met at beta. None adds a service.

The owner's ruling (26 Sep 2026): "Agree with the bundle". Viewers and fonts: a separate ADR.
