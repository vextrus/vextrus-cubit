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
