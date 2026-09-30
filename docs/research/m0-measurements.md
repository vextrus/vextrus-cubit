# M0 measurements (ticket 24)

Ticket 24 (docs/plans/M0.md, Wave 8) measures memory and time on the reference setup, and ADR 0022's
budgets are checked against it. Measured on 30 Sep 2026 at t24's branch (main at 5816445f plus the acceptance
commit). Files are named by their Development Set and the first 12 hex digits of their sha256 (the
real-drawing check names them the same way). Nothing here comes from a drawing's contents.

## The CAD worker's cap

CAD worker cap: 4294967296 bytes

That is 4 GiB, set in `vextrus/settings/jobs.py` as `VEXTRUS_CAD_WORKER_MEMORY_BYTES`. It is an
address-space limit (RLIMIT_AS, soft and hard) that `prepare_cad_worker` sets when the `cad` worker
starts. Two bounds chose it:

- **The measured peak.** The largest peak address space of a read job is 1,969,766,400 bytes (Edison
  `6999d8099e85`). 1.25 × that is 2,462,208,000 bytes (2.29 GiB).
- **The readers' own limits, the higher bound.** The read job starts its sandboxed readers under the
  worker's limit, and each reader's `prlimit` sets that reader's own address-space limit: 3 GiB for
  `dwgread`, `dwg2dxf` and the ACadSharp dumper (`engine/read/sandbox.py`, `DEFAULT_LIMITS`), and 2 GiB
  for the PDF reader and the plot's picture. `prlimit` cannot raise a limit above the hard limit it
  inherits ("Operation not permitted", measured). A cap below 3 GiB would therefore fail every DWG read.
  The .NET dumper's own peak address space reached 2,816,954,368 bytes of its 3 GiB here (sampled, below).
  `vextrus/platform/tests/test_cad_worker_cap.py` fails if the cap drops below any of these three readers' limits. A new reader with its own limit must be added to that test by hand.

4 GiB is above both bounds. It is 2.18 × the largest measured peak, which leaves room for a client's
set that is larger than these two. The cap binds only the worker process. Each reader runs under its own
limit, which is at most the cap. On this machine (26 GiB) the `cad` worker at concurrency 1 uses at most
4 GiB beside one reader of at most 3 GiB.

**Proved under the cap:** all 11 files were read again by a `cad` worker running with the cap. Its
`/proc/<pid>/limits` showed `Max address space 4294967296 4294967296 bytes`, and it logged no "without a
memory cap". Every read job ended `succeeded` (the third run below).

**A memory bomb.** No test in this ticket builds a new bomb. The existing ones pass here
(`.private/work/session-07/24/pytest-memory.txt`, 8 passed):

- `engine/read/tests/test_sandbox.py::test_it_cannot_take_more_memory_than_its_limit`: a sandboxed
  program cannot allocate past its limit.
- `engine/read/pdf/tests/test_hostile.py::test_a_stream_that_inflates_to_gigabytes_stops_at_the_memory_limit`
  (both cases) and `::TestInTheSandbox::test_a_bomb_stops_at_the_memory_limit_in_the_sandbox`: a PDF
  bomb stops at the reader's limit with `engine.pdf_report.limit_reached {limit: memory}` ("This PDF needs
  more memory than Vextrus gives one file, so it was not read. …").
- `vextrus/platform/tests/test_jobs_worker.py::test_the_cad_worker_runs_under_its_memory_cap_and_a_fork_inside_it_is_refused`:
  a real `cad` worker applies the cap as both its soft and hard limit.

**Not covered: a memory limit reached inside the worker's own Python.** A refuter proved this with a
scratch test in which a reader raises `MemoryError`. The fix is in `engine/` and `vextrus/takeoff/`,
not 24's paths, so it waits for a ruling:

- When the read job's own step (the in-process parse or render) raises `MemoryError` at the cap, it is
  not a `ReadError` (`vextrus/takeoff/services/read_propose/files.py`). The job runner tries it again as a
  fault, 3 tries in all. The file then ends failed with `drawings.files.failed` ("Could not be read after
  3 tries. The file is kept."). No words tell the QS it was memory, and the job spends two wasted tries.
- `engine/render/_shapes.py` and `_hatch.py` catch `Exception` around ezdxf's spline evaluation.
  That catches `MemoryError` too, so the spline is quietly left out as "cannot evaluate".
- A sandboxed DWG reader stopped at its own limit never shows memory words either:
  - `dwgread` segfaults, reported as `engine.read.reader_failed`.
  - The dumper is killed, and its `LimitReached("killed")` is re-wrapped as `engine.decoders_agree.stopped`.
  - `engine.read.limit_reached` has no `memory` branch.

Only the PDF reader turns a memory limit into memory words today.

## Method

- **The job:** the product's own read job, `takeoff.tasks.read_file` (21a and 21b: opening, both
  readers, the sheets and each sheet's steps, finishing). Each file was added through
  `read_file.add` into a seeded demo Project in the worktree's own database. A fresh
  `uv run manage.py worker --queue cad` then ran each job alone. The other jobs were held back
  (`scheduled_at` a year out), and the worker was stopped when the job ended. Each peak is therefore
  one file's own, measured from a cold process.
- **Memory:** every process in the worker's tree was sampled from `/proc/<pid>/status` in a loop,
  about every 10 ms plus the time to walk `/proc`. The worker's `VmPeak` (peak address space) and
  `VmHWM` (peak RSS) are high-water marks, so the last sample before the job ends catches its peak.
  The readers' peaks are sampled the same way but can be missed, since a reader may start and end
  between samples. They bound nothing here, because each reader runs under its own limit.
- **Read time:** from the job's `started` event to its `succeeded` event (`procrastinate_events`).
- **Runs:** run 1 (uncapped) counted the PDF reader's Python child as the worker, so its figures are
  not used. Run 2 was uncapped with the sampler fixed. Run 3 ran under the cap. Each peak below is the
  larger of runs 2 and 3, and the two agree to within 5%. The largest difference is the Edison file
  `3081ae5d509a`: 1,934,360,576 bytes in run 2 and 1,873,932,288 in run 3.
- **The machine:** the owner's PC, WSL2 (kernel 6.6.87.2), 24 cores and 26 GiB (28,368,330,752 bytes)
  of RAM. It was shared with other builders' sessions during the runs, so the times carry that noise.
  Python 3.14.7, with ezdxf 1.4.4's compiled wheel (sha256 checked against `toolchain/ezdxf.lock`).
  01c's build succeeded, so the pure wheel's cost was not measured. LibreDWG 0.14 and .NET 10 were
  under `/opt/vextrus`, and bubblewrap sandboxed each reader.
- **Not measured:** upload to sheet list needs 21c (not merged). It is marked "after 21c", and the
  orchestrator runs it later. The real-drawing check's own peak-RSS figures
  (`.private/work/session-07/baseline-score.txt`) measure a different process shape (the harness's
  stage runner, not the worker), so they are not comparable one for one.

A Python worker's peak address space is about 1.46 GB even for the smallest file, because the process
itself (its threads' stacks, allocator arenas and libraries) reserves it before any drawing is read.
Most of it is never touched: peak RSS stays between 0.16 and 0.69 GB.

## Per file

| Set | File | Format | Size (bytes) | Peak address space (bytes) | Peak RSS (bytes) | Read, uncapped (s) | Read, capped (s) |
|---|---|---|---|---|---|---|---|
| edison | 6999d8099e85 | DWG | 5,213,472 | 1,969,766,400 | 624,365,568 | 101.0 | 97.1 |
| edison | 2bb092f7411c | DWG | 2,613,957 | 1,628,065,792 | 378,703,872 | 43.7 | 40.2 |
| edison | 2022e479e425 | DWG | 298,144 | 1,483,493,376 | 256,577,536 | 6.1 | 3.6 |
| edison | a5a0b52d4d53 | DWG | 3,120,797 | 1,713,295,360 | 406,536,192 | 7.3 | 6.6 |
| edison | 3081ae5d509a | DWG | 3,319,721 | 1,934,360,576 | 690,094,080 | 43.5 | 40.1 |
| edison | 45f0cb01d9ec | PDF | 26,591,393 | 1,464,999,936 | 180,498,432 | 38.1 | 36.1 |
| edison | 7fb161c3650b | PDF | 15,349,874 | 1,466,048,512 | 168,468,480 | 31.0 | 30.5 |
| sample-project | bf4d3a2fd34f | DWG | 441,946 | 1,464,999,936 | 246,554,624 | 11.7 | 11.8 |
| sample-project | 2fe649d5a0fe | PDF | 6,381,193 | 1,464,999,936 | 163,680,256 | 2.9 | 3.1 |
| sample-project | 9cf0f4ea8a21 | DWG | 1,195,205 | 1,551,122,432 | 321,536,000 | 17.9 | 17.9 |
| sample-project | a4753e59d6b9 | PDF | 10,324,540 | 1,464,995,840 | 166,805,504 | 8.6 | 8.4 |

### 1. edison 6999d8099e85 (DWG, 5,213,472 bytes)

Peak address space: 1969766400 bytes

Peak RSS: 624365568 bytes. Read: 101.0 s uncapped, 97.1 s under the cap (succeeded). Upload to sheet list: after 21c.

### 2. edison 2bb092f7411c (DWG, 2,613,957 bytes)

Peak address space: 1628065792 bytes

Peak RSS: 378703872 bytes. Read: 43.7 s uncapped, 40.2 s under the cap (succeeded). Upload to sheet list: after 21c.

### 3. edison 2022e479e425 (DWG, 298,144 bytes)

Peak address space: 1483493376 bytes

Peak RSS: 256577536 bytes. Read: 6.1 s uncapped, 3.6 s under the cap (succeeded). Upload to sheet list: after 21c.

### 4. edison a5a0b52d4d53 (DWG, 3,120,797 bytes)

Peak address space: 1713295360 bytes

Peak RSS: 406536192 bytes. Read: 7.3 s uncapped, 6.6 s under the cap (succeeded). Upload to sheet list: after 21c.

### 5. edison 3081ae5d509a (DWG, 3,319,721 bytes)

Peak address space: 1934360576 bytes

Peak RSS: 690094080 bytes. Read: 43.5 s uncapped, 40.1 s under the cap (succeeded). Upload to sheet list: after 21c.

### 6. edison 45f0cb01d9ec (PDF, 26,591,393 bytes)

Peak address space: 1464999936 bytes

Peak RSS: 180498432 bytes. Read: 38.1 s uncapped, 36.1 s under the cap (succeeded). Upload to sheet list: after 21c.

### 7. edison 7fb161c3650b (PDF, 15,349,874 bytes)

Peak address space: 1466048512 bytes

Peak RSS: 168468480 bytes. Read: 31.0 s uncapped, 30.5 s under the cap (succeeded). Upload to sheet list: after 21c.

### 8. sample-project bf4d3a2fd34f (DWG, 441,946 bytes)

Peak address space: 1464999936 bytes

Peak RSS: 246554624 bytes. Read: 11.7 s uncapped, 11.8 s under the cap (succeeded). Upload to sheet list: after 21c.

### 9. sample-project 2fe649d5a0fe (PDF, 6,381,193 bytes)

Peak address space: 1464999936 bytes

Peak RSS: 163680256 bytes. Read: 2.9 s uncapped, 3.1 s under the cap (succeeded). Upload to sheet list: after 21c.

### 10. sample-project 9cf0f4ea8a21 (DWG, 1,195,205 bytes)

Peak address space: 1551122432 bytes

Peak RSS: 321536000 bytes. Read: 17.9 s uncapped, 17.9 s under the cap (succeeded). Upload to sheet list: after 21c.

### 11. sample-project a4753e59d6b9 (PDF, 10,324,540 bytes)

Peak address space: 1464995840 bytes

Peak RSS: 166805504 bytes. Read: 8.6 s uncapped, 8.4 s under the cap (succeeded). Upload to sheet list: after 21c.


## The owner's run (reference setup)

ADR 0022's reference setup is the owner's PC, with Windows Chrome forced onto the integrated GPU
(Intel UHD 770) and DevTools' 4× CPU throttle. Paste each readout into the orchestrator's session, as a
message headed `24 owner's run`. The orchestrator writes the figures into this note against the budgets.

### Setting up (once)

1. In Windows, open Settings → System → Display → Graphics, find Chrome and set it to "Power saving" (the
   integrated GPU). Restart Chrome.
2. Open `chrome://gpu` and check that "GL_RENDERER" names the Intel UHD 770, not the RTX 3060 Ti.
3. For every measurement below, open DevTools (F12), go to Performance → the gear icon, and set **CPU: 4×
   slowdown**. The throttle holds only while DevTools stays open on that tab.

### The session-01 synthetic 3D benchmark (runs now)

It is not in git. It lives at `.private/work/session-01/viewer-3d/` (docs/research/viewer-3d-budgets.md):
a synthetic G+10 building of 2,923 elements and 67,620 triangles.

1. In a WSL terminal: `cd /home/riz/vextrus-cubit/.private/work/session-01/viewer-3d && node server.mjs`
   (it prints `viewer-3d on http://127.0.0.1:5178/`).
2. In Windows Chrome, open DevTools, set the 4× throttle, and go to
   `http://127.0.0.1:5178/index.html?src=json&strategy=merged&edges=lines`. This is the cold load.
3. Wait for the model to appear. In the DevTools Console, paste this and press Enter. It copies the
   readout to the clipboard:
   `copy(JSON.stringify({gpu: bench.info().gpu, marks: bench.info().marks, calls: bench.info().calls, orbit: await bench.orbit(180), recolour: await bench.recolour(1000), pick: (bench.fit(), await new Promise(r => setTimeout(r, 300)), await bench.pick(60))}))`
4. Paste it (readout **3D cold**).
5. Reload the page (F5; the throttle stays on). That is the warm load. Run
   `copy(JSON.stringify(bench.info().marks))` and paste it (readout **3D warm**).
6. Stop the server with Ctrl-C.

These readouts go against the budgets: `marks.interactive` ≤ 1.5 s warm and ≤ 3 s cold, `orbit.gpuTimer.p95`
≤ 8 ms, `recolour.applyRenderSync.p95` ≤ 16 ms (a Confirmation), `pick.gpuIdPass.p95` ≤ 2 ms, and
`calls` ≤ 100. If `gpuTimer` reads "unavailable", Chrome has hidden the GPU timer: say so, and
`orbit.renderPlusSync` stands in for it.

### The sheet: not ready to run

These cannot be run yet, and no step is given for them:

- a cached sheet interactive (≤ 1.5 s);
- pan and zoom p95 on the densest sheet (≤ 16.7 ms a frame);
- first open.

Two pieces are missing:

- **The `?perf` readout is empty.** `?perf` turns on a flag (`web/src/app/perf.ts`) that shows the
  status bar's `status.perf` slot (`web/src/app/CanvasFrame.tsx`), but no code puts anything in that slot.
  Nothing measures a sheet's open time or frame times, and the viewer toolbar has no Measure button
  (m0-screens §1.6 specifies both).
- **No product screen opens a sheet.** Step 1's screen is ticket 22, which is not merged. The only
  viewer is the development harness at `/dev/sheet/:id`, which is not the product.

Once 22 is merged and a ticket fills `status.perf` with m0-screens §1.6's readout (frame time p50 and p95,
GPU time, open time, the renderer's name) and its Measure button, the steps are these: open the densest
sheet with `?perf` once (first open), open it again (cached), press Measure, and copy the status bar's
readout. The orchestrator re-runs this section then.
