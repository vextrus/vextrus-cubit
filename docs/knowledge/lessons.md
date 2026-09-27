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
