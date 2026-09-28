# Lessons, by area

Short, dated lessons that cost us something once. Each is written in the same PR (or session) as the
fix that taught it (ADR 0030). Read the area you are working in before you start.

## Harness and agents
- **Parallel agents share one chrome-devtools browser.** 26 Sep 2026: a prototype agent selected the
  wrong tab and sent keypresses into another agent's page, and its window resizes changed the other
  agents' viewports. Always select your own page by URL before acting, and use per-page viewport
  emulation, never window resizes. Treat measurements taken while another agent drove the browser as
  suspect.
- **Subagents may be refused writing report `.md` files.** They return the text instead; the
  orchestrator writes it. Plan prompts so the report comes back in the final message.
- **The guard splits Bash commands on `|`, `;` and newlines.** A heredoc or regex containing `sudo`,
  `su` or a pipe at a line start is refused. Write such files with the Write or Edit tool.

## Reading drawings
- **`dwgread` cannot check LibreDWG.** It shares the decoder; LibreDWG 0.13.3 lost a 2007-format file
  and a count check against `dwgread` passed it. Compare against ACadSharp (ADR 0029).
- **`dwg2dxf` corrupts text with raw line breaks;** read text from `dwgread` JSON.
- **Rules fitted to one office read nothing at the next.** The session-10 prototype ran zero stages
  on the Sample Project until 17 fittings (docs/research/sample-project-first-read.md).
- **LibreDWG 0.14 drops ATTRIB text styles** (null style handle); inherit the style from the ATTDEF
  with the same tag (docs/research/viewer-2d-fidelity.md).
- **dxf-viewer hides ATTRIBs carrying an embedded xrecord and draws no leaders:** it is not our sheet
  renderer.
- **Thin CAD lines as GL_LINES, never one quad per segment** (242 ms vs 19 ms a frame).
- **Aligned TEXT and ATTRIB from LibreDWG carry start point = alignment point** (all 3,016 non-left
  aligned ones in the Sample Project); AutoCAD plots from the start point, so draw from it, not from
  ezdxf's alignment placement (proto-sheet, 26 Sep 2026).
- **Every recognised figure must record its source handles** when it is read; re-finding them later
  by re-running rules is fragile (ADR 0031's Trace anchor).
- **SHX text drawn as single strokes (Hershey simplex) matched the plot's width at 0.997 (median of 78
  lines);** outline substitutes run 13–19 % narrow.
- **LibreDWG's `dxf2dwg` is no fixture writer** (ticket 04, 28 Sep 2026): it writes only R2000 and
  R2004, dropped every model-space layer and the MTEXT heights, and on R2004 lost model space. ACadSharp
  writes the fixtures from ezdxf's DXF, but its DXF reader leaves ATTRIBs beside their INSERT, so the
  writer moves them back (engine/fixtures/dwg/_writer/). LibreDWG 0.14 then decodes ACadSharp's
  AC1024 and AC1032 ATTRIBs with a null style, as on real files; AC1018's keep theirs.
- **bwrap's PID namespace hides the sandboxed program's rusage** from the caller (0.005 s reported for
  a 1 s CPU loop): the sandbox tells a CPU kill by SIGXCPU, and peak memory is measured at the parse.

## Session 02 (27–28 Sep 2026)
- **An app restart kills every background agent.** All nine died mid-task once; the partial work in their
  folders survived. Every long agent keeps a `NOTES.txt` progress log after each milestone and is told how
  to resume from it.
- **Vite's hot reload loops a page in the shared chrome-devtools browser** (its watcher sees its own log);
  prototypes run with HMR off or with the log ignored. A background tab is throttled to about one frame a
  second, so fps read from it is not real: measure render cost, not frame interval.
- **Headless Chrome in WSL has only SwiftShader:** every GPU figure an agent takes is relative; the
  reference-setup number needs the owner's PC.
- **Reading real drawings:** apply every insert's object-to-world transform (mirrored inserts put 25 of 47
  Edison piles 77,000 in away); read an MTEXT angle from its direction vector (98 of 139 beam labels
  unbound otherwise); MTEXT inside blocks may have no height; guard every geometry repair
  (self-intersecting outlines collapse to empty); never hard-code an N or a storey count; MEP symbol base
  points can lie far from their geometry, so locate by the geometry's centre; the same MEP point repeats
  on up to three sheets.
- **Row-level security:** after a transaction-local `set_config`, the setting reads back as `''` on a
  pooled connection, so policies read `nullif(current_setting('app.tenant_id', true), '')::uuid`; under
  FORCE RLS a foreign key added to a populated table as its owner fails (parent rows hidden).
- **WeasyPrint breaks Bangla conjuncts** (Chrome's print does not); dimensions inside Arabic text read
  backwards unless isolated left to right; Chrome has no `en-BD` formats.
- **A python edit that fails its assertion writes nothing, and a `;`-chained commit still runs:** chain
  the commit with `&&` after an edit script, never `;` (a research file was once committed without its
  corrections).
- **Refuters earn their cost on research:** four of five research files needed corrections before
  commit (a lift price rise stated as 81 % that was 22 %; a fire gap stated as 3× that was 2.4×; an
  iTwin claim reversed; a groove item's scope).

## Session 03 (28 Sep 2026): wave 0 and wave 1, the first build
The owner's ruling that frames these: cost is not the constraint; quality on every merge is, with as
much parallel work as that quality allows, and each wave applies the last one's lessons.
- **Two tickets meeting at a contract, built in parallel, drift.** 06a read an export shape it assumed
  from the plan; 06b wrote the real one; the first baseline could not read it. The fit was found only
  by running one inside the other (the review of #62). When a wave's tickets meet at a contract, the
  owner of the shape merges first, the other builds against fixtures generated by the real code, and
  the review runs the two together before either merges.
- **A check that cannot show failure hides breakage.** The first baseline reported every measure at
  0 items and looked clean; 04's `read` stage had failed on every DWG. Every report names the stages
  that failed, beside those not built, and never presents zero without what ran.
- **bwrap nested in bwrap needs a `/tmp`:** without one the inner fails "Failed to mount tmpfs: No such
  file or directory". The outer sandbox mounts a private `--tmpfs /tmp`.
- **Reviews found a real security hole in three of five wave-1 tickets,** each missed by its author and
  its refuter: a tree entry named `..` written outside the checkout (06a; git's plumbing accepts it,
  only its checkout refuses it); a planted symlink followed out of the sandbox (04); the app role able
  to set the staff flag, by UPDATE and then by INSERT (02). Every harness and security PR gets a bug
  scan aimed at its trust boundary, and fixes land before merge.
- **PR bodies overclaim.** A mutation claim true only for removed thresholds, "fits 06a" before anyone
  checked, a revert credited to "the owner's ruling" the owner never made. Reviewers check each claim
  against evidence; nobody attributes a ruling that was not given.
- **The pseudo right-to-left language must be right to left in strength.** Accented Latin is left to
  right to the browser and hid an unisolated `14′-6″`; each run is wrapped in U+202E…U+202C, and every
  value filled into a message is isolated with U+2068…U+2069 at render.
- **A cloud session may act on a PR comment before its follow-up arrives** (06b reshaped its export,
  then reverted it). Send the follow-up with the decision first; post the review comment after.
- **The cloud image** (Ubuntu 24.04): its Launchpad PPAs answer 403, failing every `apt-get update`
  (set them aside); its `uv` predates Python 3.14.7 and silently fetched 3.14.0rc2 (install a pinned
  uv); it has no `gh`; the setup cannot reach the private release while a session can, through its
  GitHub proxy; concurrent apt runs lose each other's `.deb`s (one `flock`); the session runs as root
  (a read-only test checks ownership and mode); `$CLAUDE_PROJECT_DIR` is empty during setup; LibreDWG
  from source takes 235–250 s of the 300 s budget.
- **`uv sync` and `uv run` reinstall `uv.lock`'s pure ezdxf** over the compiled wheel: where speed or the
  toolchain test matters, lay the wheel over it and run with `--no-sync`.
- **Debian's pip bends `--prefix` into `local/`;** `--target` puts a tool where a script expects it.
- **Diagnostics name exact paths:** a `cpython-3.14*` glob matched two folders and ran one interpreter
  on the other's binary, which read as a broken Python.
