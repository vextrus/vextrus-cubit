# Jev nodes: spot checks

ADR 0011, item 3: every Jev node ships with a spot check of about 30 real items, a measured queue size
and a pinned model version, in one table; counts in git, the labelled items in `.private/`;
re-measured when the model changes. The last row of a node is its current measure.

- **Right**: Jev's choice is the label, whatever its confidence (an unavailable answer is never right).
- **Queue**: the sheets the QS would be asked about: an answer below the node's threshold
  (`VEXTRUS_JEV_SHEET_TYPE_PROPOSE_AT`) or Jev unavailable.
- **How**: `uv run manage.py jev_spot_check <labels.jsonl> --question "..."`, locally, with the
  owner's development key (ADR 0013). The labels and the per-item answers stay in
  `.private/work/session-06/23/`.

| node | model | right / checked | queue | threshold | options sent | view titles | measured |
|---|---|---|---|---|---|---|---|
| sheet_type | jev-1.13.0 | 26 / 32 | 13 | 0.90 | keys only (as 13 sends them) | none (`"[]"`, before 17) | 29 Sep 2026 |

## sheet_type, 29 Sep 2026

**The items.** 32 sheets drawn at random within quotas the builder chose (Python's
`random.Random(23).sample` per Discipline, in the order below) from the 271 sheets that 13's engine
(as on main at `6b169c21`) asks about in the two real Development Sets, by Discipline: Edison 8 architectural,
7 structural, 4 electrical and 3 plumbing; the Sample Project 5 architectural and 5 structural. The
facts are exactly what `sheets.judgement` sends: the title, the Discipline, and `view_titles` `"[]"`
(17 has not merged). The options are the Discipline's kinds with the common ones: 15 to 25 options.
The builder labelled each sheet from its title and number, not a QS. For 8 of the 32, a second kind
is also a fair answer (`lintel_layout` or `slab_outline_layout`, `slab_layout` or
`roof_structure_details`, `cover_index` or `general_notes`, and the like).

**By kind** (keys only): all right except `slab_layout` 0 / 2, `tank_details` 0 / 2,
`lighting_layout` 2 / 3 and `cover_index` 0 / 1. Wrong answers, as labelled kind -> Jev's choice:
`tank_details -> details` 2, `slab_layout -> details` 1, `slab_layout -> roof_structure_details` 1,
`lighting_layout -> power_wiring_layout` 1, `cover_index -> general_notes` 1. Counting the second
fair kind as right, 30 / 32.

**At the threshold (0.90)** the queue is 13 of 32 (41%). The two repeats were kept per item, and in
each 19 or 20 answers were proposed: 17 or 18 of them are the label and 2 are the second fair kind.
No proposed answer was neither.

**Repeats.** The same 32 questions, asked three times: right 26, 26 and 26; queue 13, 12 and 13.
One of the 96 keys-only answers was `Unavailable(malformed)`: TypeSafe answered, but the client refused
the reply as no answer to the question asked. The queue of 12 counts that sheet.

### Should the kinds carry descriptions?

The options were also sent with a one-line description per kind. The builder wrote the descriptions
before drawing the sample, from the kinds' keys alone.

| options sent | right / checked (3 runs) | right or fair (2 runs) | queue (3 runs) | proposed and neither (2 runs) |
|---|---|---|---|---|
| keys only | 26, 26, 26 / 32 | 30 / 32 | 13, 12, 13 | 0 |
| with descriptions | 27, 28, 28 / 32 | 31 / 32 | 10, 10, 10 | 0 |

The descriptions gained a right answer or two: `cover_index`, and one `lighting_layout` sheet on two of
the three runs. They also took 3 sheets out of the queue, and no answer that is neither the label nor its fair
second kind was proposed. One `tank_details` sheet was proposed as `details`, its fair second kind, in both variants. **Ruling
(23): the kinds carry descriptions.** 15's live check points the same way: 2 of 7 invented sheets
changed answer without them. The descriptions belong with the kinds, in 13's sheet conventions (an
engine path), so a later engine ticket adds them. This table is re-measured then, and after 17 sends
view titles.

**Not known.** 32 sheets from 2 sets are a small sample: one sheet is 3 points. No QS has checked
the labels.
