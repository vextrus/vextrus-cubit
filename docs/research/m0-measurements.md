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

- **The measured peak.** The largest peak address space of a read job is 1,002,434,560 bytes (Edison
  `6999d8099e85`, run 4), and 1.25 × that is 1,253,043,200 bytes. Before the worker's numerical
  libraries were pinned to one thread (below), the same file peaked at 1,969,766,400 bytes, and
  1.25 × that is 2,462,208,000 bytes (2.29 GiB).
- **The readers' own limits, the higher bound.** The read job starts its sandboxed readers under the
  worker's limit, and each reader's `prlimit` sets that reader's own address-space limit: 3 GiB for
  `dwgread`, `dwg2dxf` and the ACadSharp dumper (`engine/read/sandbox.py`, `DEFAULT_LIMITS`), and 2 GiB
  for the PDF reader and the plot's picture. `prlimit` cannot raise a limit above the hard limit it
  inherits ("Operation not permitted", measured). A cap below 3 GiB would therefore fail every DWG read.
  The .NET dumper's own peak address space reached 2,816,954,368 bytes of its 3 GiB here (sampled, below).
  `vextrus/platform/tests/test_cad_worker_cap.py` fails if the cap drops below any of these three
  readers' limits. A new reader with its own limit must be added to that test by hand.

4 GiB is above both bounds. It is 4.3 × the largest measured peak (2.18 × the unpinned one), which
leaves room for a client's set larger than these two. The cap binds only the worker process. Each
reader runs under its own limit, which is at most the cap. The `cad` worker at concurrency 1 therefore
takes at most 4 GiB of address space beside one reader of at most 3 GiB: 7 GiB, as an upper bound on
memory it may touch. On this machine (26 GiB) that is ample. On the beta's machine, GCE
`n2d-standard-4` (4 vCPU, 16 GB; docs/research/deploy-providers.md), it leaves about 9 GB for the web
and default-queue containers. The measured RSS peaks (at most 0.66 GB for the worker and 0.32 GB for a
reader) are far below it.

**One numerical-library thread (review of 24).** numpy's OpenBLAS starts a thread per core when it
loads, and each thread's reserved memory counts against the cap. On this 24-core machine the idle
worker's address space was 1.21 GB. It was 0.39 GB with 4 CPUs, and 0.27 GB with
`OPENBLAS_NUM_THREADS=1` (the reviewer's measures). So a bigger machine needed a bigger cap for the
same drawing. `vextrus/__init__.py` now sets `OPENBLAS_NUM_THREADS`, `OMP_NUM_THREADS` and
`MKL_NUM_THREADS` to 1 in every Vextrus process, unless already set, before `django.setup` loads
numpy. `test_jobs_worker.py::test_the_cad_worker_runs_its_numerical_library_on_one_thread` asserts,
through a real `cad` worker whose environment names no thread count, that OpenBLAS runs one thread
and the worker has at most 4 (`/proc/self/task`: 2 measured). It fails with 24 threads without the
pin. Run 4 re-read all 11 files this way: every peak fell by 0.5 to 1.0 GB, and read times did not
grow.

**Proved under the cap:** all 11 files were read again by a `cad` worker running with the cap. Its
`/proc/<pid>/limits` showed `Max address space 4294967296 4294967296 bytes`, and it logged no "without a
memory cap". Every read job ended `succeeded` (runs 3 and 4 below).

**A memory bomb.** `vextrus/platform/tests/test_jobs_worker.py::test_a_cad_job_that_runs_out_of_memory_at_the_default_cap_fails_without_a_retry`
starts a real `cad` worker with the settings' own cap and gives it a step that asks for 64 GiB. The job
ends `failed` after one try: `jobs._Retry` treats `MemoryError` as final, because the same try would
reach the cap again. Before the fix it went back to wait for a second try.

For a read job, `read_propose.files.read` turns a `MemoryError` in any of its steps into the file's
reason, `engine.read.limit_reached {limit: memory}`: "The drawing could not be read: it needs more
memory than Vextrus gives one file. Mark the file for Vextrus." The file ends failed at once
(`test_read_file.py::test_a_reader_out_of_memory_fails_the_file_with_the_memory_words_and_no_retry`).
`engine/render/_shapes.py` and `_hatch.py` no longer catch `MemoryError` as an undrawable spline
(`engine/render/tests/test_out_of_memory.py`). `ux-critic`'s words gate passed the new sentence. Its
optional point was applied: `killed` now reads "…it was stopped, most likely because it needs more
memory than Vextrus gives one file…".

The existing sandbox tests still pass (`.private/work/session-07/24/pytest-memory.txt`):

- `engine/read/tests/test_sandbox.py::test_it_cannot_take_more_memory_than_its_limit`;
- `engine/read/pdf/tests/test_hostile.py`'s two gigabyte-stream cases and
  `TestInTheSandbox::test_a_bomb_stops_at_the_memory_limit_in_the_sandbox`
  (`engine.pdf_report.limit_reached {limit: memory}`).

**Still without memory words:** a sandboxed DWG reader stopped at its own 3 GiB limit. `dwgread`
segfaults, which reads as `engine.read.reader_failed`. The ACadSharp dumper is killed, and that is
worded as `engine.decoders_agree.stopped` (the second reader stopped, "a fault on Vextrus's side").
Both end the file at once, with no retry. Only their words do not say memory, since neither exit can
be told apart from another crash reliably.

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
  not used. Run 2 was uncapped with the sampler fixed, and run 3 ran under the cap. The two agree to
  within 5%; the largest difference is the Edison file `3081ae5d509a`, at 1,934,360,576 bytes in run 2
  and 1,873,932,288 in run 3. Run 4 ran under the cap with the numerical libraries on one thread, and
  it gives the figures below. The table keeps the larger of runs 2 and 3 as "unpinned".
- **The machine:** the owner's PC, WSL2 (kernel 6.6.87.2), 24 cores and 26 GiB (28,368,330,752 bytes)
  of RAM. It was shared with other builders' sessions during the runs, so the times carry that noise.
  Python 3.14.7, with ezdxf 1.4.4's compiled wheel (sha256 checked against `toolchain/ezdxf.lock`).
  01c's build succeeded, so the pure wheel's cost was not measured. LibreDWG 0.14 and .NET 10 were
  under `/opt/vextrus`, and bubblewrap sandboxed each reader.
- **Not measured:** upload to sheet list needs 21c (not merged). It is marked "after 21c", and the
  orchestrator runs it later. The real-drawing check's own peak-RSS figures
  (`.private/work/session-07/baseline-score.txt`) measure a different process shape (the harness's
  stage runner, not the worker), so they are not comparable one for one.

A pinned worker's peak address space is about 0.50 GB even for the smallest file: the process itself
(its threads' stacks, allocator arenas and libraries) reserves it before any drawing is read. Unpinned
on 24 cores it was about 1.46 GB. Peak RSS stays between 0.16 and 0.66 GB.

## Per file

Run 4: the product as this ticket leaves it (the cap, and one numerical-library thread).

| Set | File | Format | Size (bytes) | Peak address space (bytes) | Peak RSS (bytes) | Read (s) | Unpinned peak address space (bytes) |
|---|---|---|---|---|---|---|---|
| edison | 6999d8099e85 | DWG | 5,213,472 | 1,002,434,560 | 659,791,872 | 86.7 | 1,969,766,400 |
| edison | 2bb092f7411c | DWG | 2,613,957 | 661,774,336 | 378,228,736 | 37.6 | 1,628,065,792 |
| edison | 2022e479e425 | DWG | 298,144 | 517,074,944 | 255,864,832 | 3.0 | 1,483,493,376 |
| edison | a5a0b52d4d53 | DWG | 3,120,797 | 747,008,000 | 406,241,280 | 6.1 | 1,713,295,360 |
| edison | 3081ae5d509a | DWG | 3,319,721 | 908,091,392 | 629,817,344 | 36.3 | 1,934,360,576 |
| edison | 45f0cb01d9ec | PDF | 26,591,393 | 498,839,552 | 179,712,000 | 34.4 | 1,464,999,936 |
| edison | 7fb161c3650b | PDF | 15,349,874 | 498,704,384 | 167,907,328 | 29.2 | 1,466,048,512 |
| sample-project | bf4d3a2fd34f | DWG | 441,946 | 498,708,480 | 247,304,192 | 10.6 | 1,464,999,936 |
| sample-project | 2fe649d5a0fe | PDF | 6,381,193 | 498,712,576 | 162,693,120 | 2.6 | 1,464,999,936 |
| sample-project | 9cf0f4ea8a21 | DWG | 1,195,205 | 585,285,632 | 321,863,680 | 15.9 | 1,551,122,432 |
| sample-project | a4753e59d6b9 | PDF | 10,324,540 | 498,716,672 | 165,953,536 | 5.6 | 1,464,995,840 |

### 1. edison 6999d8099e85 (DWG, 5,213,472 bytes)

Peak address space: 1002434560 bytes

Peak RSS: 659791872 bytes. Read: 86.7 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1969766400 bytes, read 101.0 s and 97.1 s. Upload to sheet list: after 21c.

### 2. edison 2bb092f7411c (DWG, 2,613,957 bytes)

Peak address space: 661774336 bytes

Peak RSS: 378228736 bytes. Read: 37.6 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1628065792 bytes, read 43.7 s and 40.2 s. Upload to sheet list: after 21c.

### 3. edison 2022e479e425 (DWG, 298,144 bytes)

Peak address space: 517074944 bytes

Peak RSS: 255864832 bytes. Read: 3.0 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1483493376 bytes, read 6.1 s and 3.6 s. Upload to sheet list: after 21c.

### 4. edison a5a0b52d4d53 (DWG, 3,120,797 bytes)

Peak address space: 747008000 bytes

Peak RSS: 406241280 bytes. Read: 6.1 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1713295360 bytes, read 7.3 s and 6.6 s. Upload to sheet list: after 21c.

### 5. edison 3081ae5d509a (DWG, 3,319,721 bytes)

Peak address space: 908091392 bytes

Peak RSS: 629817344 bytes. Read: 36.3 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1934360576 bytes, read 43.5 s and 40.1 s. Upload to sheet list: after 21c.

### 6. edison 45f0cb01d9ec (PDF, 26,591,393 bytes)

Peak address space: 498839552 bytes

Peak RSS: 179712000 bytes. Read: 34.4 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1464999936 bytes, read 38.1 s and 36.1 s. Upload to sheet list: after 21c.

### 7. edison 7fb161c3650b (PDF, 15,349,874 bytes)

Peak address space: 498704384 bytes

Peak RSS: 167907328 bytes. Read: 29.2 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1466048512 bytes, read 31.0 s and 30.5 s. Upload to sheet list: after 21c.

### 8. sample-project bf4d3a2fd34f (DWG, 441,946 bytes)

Peak address space: 498708480 bytes

Peak RSS: 247304192 bytes. Read: 10.6 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1464999936 bytes, read 11.7 s and 11.8 s. Upload to sheet list: after 21c.

### 9. sample-project 2fe649d5a0fe (PDF, 6,381,193 bytes)

Peak address space: 498712576 bytes

Peak RSS: 162693120 bytes. Read: 2.6 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1464999936 bytes, read 2.9 s and 3.1 s. Upload to sheet list: after 21c.

### 10. sample-project 9cf0f4ea8a21 (DWG, 1,195,205 bytes)

Peak address space: 585285632 bytes

Peak RSS: 321863680 bytes. Read: 15.9 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1551122432 bytes, read 17.9 s and 17.9 s. Upload to sheet list: after 21c.

### 11. sample-project a4753e59d6b9 (PDF, 10,324,540 bytes)

Peak address space: 498716672 bytes

Peak RSS: 165953536 bytes. Read: 5.6 s (succeeded, under the cap, numerical libraries on one thread). Unpinned (runs 2 and 3): peak address space 1464995840 bytes, read 8.6 s and 8.4 s. Upload to sheet list: after 21c.

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
2. In Windows Chrome, open DevTools and set the 4× throttle. For the cold load, also open the Network
   tab, tick **Disable cache**, and set the throttling menu (beside "Disable cache") to a custom profile
   named `10 Mbps`: Add… → Download 10000 kbit/s, Upload 10000 kbit/s, Latency 20 ms. ADR 0022's cold
   budget is on 10 Mbps. Then go to
   `http://127.0.0.1:5178/index.html?src=json&strategy=merged&edges=lines`. This is the cold load.
3. Wait for the model to appear. In the DevTools Console, paste this and press Enter. It copies the
   readout to the clipboard:
   `copy(JSON.stringify({gpu: bench.info().gpu, marks: bench.info().marks, calls: bench.info().calls, orbit: await bench.orbit(180), recolour: await bench.recolour(1000), pick: (bench.fit(), await new Promise(r => setTimeout(r, 300)), await bench.pick(60))}))`
4. Paste it (readout **3D cold**).
5. For the warm load, untick **Disable cache** and set the network throttling back to "No throttling"
   (the CPU throttle stays on). Reload the page (F5) once to fill the cache, then reload again. That is
   the warm load. The prototype's server sends `Cache-Control: no-store`, so this "warm" load fetches
   everything again without the network throttle: it is an upper bound on a warm load. Run
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
