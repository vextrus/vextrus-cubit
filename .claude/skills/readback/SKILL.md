---
name: readback
description: Read back what a J-000 journey actually stored for the F-RCC6-BNBC project — quantity lines by class, kind and coverage, register objects, orphan lines — through the cubit MCP db_read tool, and compare it with the standing ground truth. Use after every J-000 run, after any change to rails, the gate, levels or the partition, and before claiming a quantity moved.
---
# Reading a J-000 run back

The lanes check contracts; a read-back checks the numbers the store holds. It caught what the lanes
missed in session 7 (the 1F beams registered twice; 50 orphan beam lines).

1. **After** the run, with no db lane running. Find the project (newest first):
   `db_read` `{ unscoped: true, reason: "find the newest BNBC project", sql: "select project_id, created_at from projects where name = 'Bashundhara G+6' order by created_at desc limit 5" }`
   The run file naming the project is deleted by the next Playwright lane; the database keeps every run.
2. **Scope every query** with `project_id` and `:'pid'` — the canonical queries are
   `docs/handoff/session-7-readback.sql` (psql `:'pid'` form; paste each statement into `db_read`):
   - lines of the newest campaign by class × kind × coverage, with totals;
   - register objects by element type (and how many have no level);
   - I-368's invariant: `orphan_lines` and `placeholder_lines` both 0.
3. **Compare with the ground truth** (session 8's close; a run that reads anything else moved it):
   - column concrete 208 COMPLETE lines, 93.892896 m³ (FDN 3.0596 plus GF..6F);
   - piles 89 / 1,898.904 m / 372.848929 m³ (89 objects, unlevelled as in session 7); caps 26 lines /
     128.781275 m³, formwork 254.132613 m² (26 cap objects since session 8 — was 89; slice to be named);
   - beams 356 register objects (1 on no level, S-13's LB1 placeholder), 710 lines, every one PARTIAL
     (FRM3-B placed the vertical beams in session 8; no beam COMPLETE before FRM-4);
   - orphan_lines 0; 13 golden cells COMPLETE: 595.523 of 1,186.893 m³ of RCC concrete.
   The golden itself is `fixtures/rcc6-bnbc/takeoff.golden.json` (read through `goldenRows`).
4. **Report** the figures as read (query and rows), what moved and why; a moved figure is either a
   lawful change you can name (then update the ground truth where the handoff keeps it) or a defect.
