# PERF — the register's page and the upload's bytes (AM-10)

Two places where the product's cost grows with the size of a real job rather than with the size of
the answer it gives. Neither is a fault today: both are correct, and both stop being affordable at
the scale of one Dhaka consultant's set. They are written here as **spec items**, each naming the
assertion the increment that lands it must carry, so the assertion is settled before the code is —
and so a later session cannot land the easy half and leave the proof for someone else.

Filed under AM-10. The Bible is not amended by this file: these are PERF items against clauses the
Bible already states (R-UI-050's register reading, R-UI-018's upload session), not new law.

---

## PERF-01 — the register is paginated and aggregated in SQL

**Where.** `src/modules/takeoff/register-ui/server.ts` — `registerViewOf` (the `Promise.all` at ~:79).

**What it does now.** Eight readings of the whole campaign are taken in parallel and every row of
each is carried into the process, where the view is assembled by walking them: every register
object, every published line, every queued item, every refused sighting, every observation of the
revision, every level of every stack. The reading is *whole* by design — the screen shows standings
that only the whole set decides — and at 50,000 lines the whole set is the cost of one page of
fifty.

**What it should do.** The page is decided in SQL: the ordering, the filter, the standing rollup and
the count are one statement over the campaign, and the process receives the page it will render plus
the totals the screen states. The rollups that the eight readings compute in TypeScript
(`standingOf` and its kin) move into the same statement, because a rollup computed over rows the
page did not fetch is a rollup that had to fetch them.

**The assertion the increment must carry.**

1. *The rows fetched do not grow with the register.* Against a live campaign seeded at 200 lines and
   again at 50,000, rendering **the same page of 50** fetches the same number of rows (±the page
   size), proved by counting rows returned at the seam — not by timing, which measures the machine.
2. *The page is decided once.* The whole reading of one page is **one** statement per rail per
   surface, counted the way `db/__tests__/batched-writes.live.test.ts` counts one: by the cluster's
   own witness, not by a statistic.
3. *The totals are the store's.* The count and the standing rollup the screen prints are read from
   the same statement that read the page, so a total can never disagree with the rows under it
   (B-17: one fact, one home).
4. *The screen is unchanged.* The register journey (J-030) passes with no change to its assertions —
   a faster reading that shows a different register is a different product.

---

## PERF-02 — an upload is streamed, never buffered whole

**Where.** `src/modules/spine/uploads/session.ts` — `const bytes = new Uint8Array(await readFile(path))` (~:413), and the archive path that follows it.

**What it does now.** The staged file is read into one `Uint8Array`, handed to the scanner, and
handed on to the settle. A 400 MB DWG set is 400 MB of process memory, at the moment several lanes
may each be holding one — which is the shape of an out-of-memory kill, not of a slow request.

**What it should do.** The bytes reach the scanner and the store as a stream. The digest is taken as
the stream passes (it already is, for the staged head), the scanner is fed chunks, and the object is
written to storage from the stream rather than from an array. An archive member is expanded through
the same path, one member at a time.

**The assertion the increment must carry.**

1. *Memory does not track file size.* Completing a session over a file of N MB holds no more than a
   fixed ceiling of heap at any moment (measured at a sampled `process.memoryUsage().heapUsed`
   against a synthetic file large enough that a buffered read would be unmistakable — 256 MB against
   a ceiling of ~32 MB), and the ceiling is stated in the test, not derived from the run.
2. *The digest and the verdict are unchanged.* The sha256 the streamed path records is byte-for-byte
   the one the buffered path recorded for the same file, and an infected fixture is still refused
   `SCAN_REJECTED` — a stream that changed an answer would be a different upload.
3. *A partial stream settles nothing.* A stream that fails halfway leaves no object in the store and
   no record in the register, and answers a registered refusal naming the session — never a
   half-written drawing that a later pass reads as whole (L-QTY-04).
4. *The archive path streams too.* A zip of N members holds one member at a time, proved the same
   way as (1) against a fixture whose members together exceed the ceiling.

---

## Why these are spec items and not code today

Wave B's budget went to the correctness items that a real set breaks first: the notation grammar, the
one expression tree, cad's refusals, the artifact read once per hash and the batched write. Each of
those is a wrong or lost *answer*; these two are a cost. A cost that is written down with its
assertion is a cost the next session can land in one increment; a cost that is half-landed without
one is a regression nobody can see. Filed rather than rushed, deliberately.
