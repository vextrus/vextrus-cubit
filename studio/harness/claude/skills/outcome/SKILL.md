---
name: outcome
description: How the lead turns a piece of work into an outcome and runs it - pick the defects, write the rubric the builder and grader share, run /outcome, record the grades, commit, update CHECKPOINT.md. Use for every unit of prototype work after the audit.
---

# Running an outcome

1. **Pick the work.** Take a cluster from the latest audit's defects: one cause, or one area (for
   example "columns and beams detached from each other, all storeys"), at most a day of building.
   Clusters that touch different files can run as parallel outcomes; ones that share files run one
   after another.
2. **Make the folder** `outcomes/<NN-name>/` with:
   - `DEFECTS.json`: the cluster's defects, each with `id`, `title`, `severity`, `element_ids`,
     `evidence` and `status: "open"`. Agents change only `status`.
   - `RUBRIC.md`, from `outcomes/RUBRIC-TEMPLATE.md`. Every defect becomes at least one criterion. A
     criterion is about the building and the screen, not about files existing. Geometry criteria name the
     check that judges them; if the check doesn't exist yet, the first criterion is to write it, and to
     show it failing on today's model.
3. **Brief the builder** in the `/outcome` args: the files it may change, the checks to run, the
   storeys and views to look at, and `elapsed / budget`. Use `builder` for geometry, the generator and
   three.js, and `builder-light` for UI and wording.
4. **Run** `/outcome` with `{out, builder, rounds: 3, brief}`. Write each returned grade to
   `grades/round-<n>.md`.
5. **Read the result yourself** before accepting it. Open the prototype, look at three of the fixed
   Elements, and read the grader's evidence. If the grader approved something you can see is wrong,
   tighten its criterion and note it in `CHECKPOINT.md` (the grader is tuned from transcripts).
6. **Close.** Commit with explicit paths and a message naming the outcome and its defect ids. Update
   `CHECKPOINT.md` (done, open, decisions, next). If the rounds ran out, split what is left into a new
   outcome. Don't loosen the rubric to make it pass.

The audit (`/proto-audit {out}`) runs again after every few outcomes, to measure what is left and to
find what fixes broke.
