# Jev and System One: what it can do for Vextrus, and where code or an LLM belongs

Researched 2026-09-25. Question: what can TypeSafe's Jev (and comparable System One / classifier
models) do, at what cost, speed and reliability? Which Vextrus nodes should use it, which need code
alone, and which need a System Two LLM?

Sources: TypeSafe docs (docs.typesafe.ai, read as Markdown through `llms.txt`), the manifesto, the
homepage, the privacy policy and DPA, and primary papers for the alternatives. Live tests: 226
requests to `jev-1.13.0` from this machine (WSL2), run today with invented, generic examples. Nothing
came from `.private/`. The harness and raw results are in `.private/work/jev-system-one/`
(gitignored; no key in them).

**Bottom line.** Jev is a fast, very cheap, calibrated classifier that you can program in words. It
fits most of Level 1 and the "understand the Ask" half of Level 2 well. It cannot generate text,
cannot return a value it was not offered, is weak on numbers, and reads text only. Every quantity,
every conversion and every range check stays in code. A System Two LLM is needed only for
generation, open-ended multi-step reasoning, and images (scanned drawings). None of these is on the
MVP's critical path unless the MVP must read raster PDFs.

---

## 1. What Jev is, per its own sources

- **A System One model, not an LLM.** Jev "evaluates typed *questions* against a *state* and returns
  structured results directly. No text generation, no parsing"
  ([Introduction](https://docs.typesafe.ai/introduction)). It "does not generate text, write code,
  or hold a conversation" ([Jev with coding agents](https://docs.typesafe.ai/introduction/coding-agents)).
  The name follows Kahneman: "fast, focused judgments" ([System One](https://docs.typesafe.ai/concepts/system-one)).
- **Training: RLCD** ("reinforcement learning for calibrated decisions"). Probabilities are optimised
  so that "outcomes assigned a probability of 0.8 should occur about 80% of the time". The docs also
  say "these rates describe groups of predictions, not a guarantee about any single answer"
  ([AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer)).
- **The thesis** ([manifesto](https://typesafe.ai/manifesto)): "machine-native composable AI", with
  intelligence "layered alongside existing software as a primitive that any programmer can invoke".
  Automation is expected to be "99% machine-to-machine" ([AI primer](https://docs.typesafe.ai/introduction/machine-learning-primer)).
  The manifesto gives no figures.
- **Design rule, from the docs:** "Keep control flow, deterministic rules, and side effects in code.
  Break broad judgments into narrow, typed questions"
  ([How to build](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)). This is the same
  split the owner ruled for Vextrus: the machine judges and code computes.

### Primitives ([API](https://docs.typesafe.ai/api), [Primitives](https://docs.typesafe.ai/primitives))

| Primitive | Returns | Limits |
|---|---|---|
| **Choice** | the top option, a probability for each option, and `confidence` | up to 255 options |
| **Score** | a probability-weighted level, per-level probabilities, and `confidence` | 2 to 10 ordered levels |
| **Noul** | a probability of "yes", 0 to 1 | no separate confidence |

One request carries one `state` (a string, JSON or an array) and a map of questions. The questions
are evaluated "in parallel and in isolation" against the same state. The docs' own cookbook
measured that 13 questions in one call cost 12.2x less and ran 10x faster than 13 separate calls
([Parallel questions](https://docs.typesafe.ai/cookbooks/parallel_questions)).

### Price, limits, data ([Models](https://docs.typesafe.ai/models))

- **Price:** $0.042 per million input tokens; "output tokens are free". The homepage claims "238x
  lower input price than Claude Fable 5.1" and a 0.114 s median against 8.566 s for LLMs
  ([typesafe.ai](https://typesafe.ai)). No public pricing page exists (typesafe.ai/pricing returns
  404), and I found no statement of a free tier.
- **Rate limits:** 250,000 tokens/s and 1,200 requests/min. The docs warn: "limits are adjusting
  dynamically ... can change without notice". Higher limits come with enterprise plans.
- **Context:** 64k tokens per request, and 32k for the state plus the longest question.
- **Input:** text only, "no image, audio, or video".
- **Language:** "English is the primary training language ... Other languages ... handled but not
  equally well."
- **No customisation:** "Jev is not fine-tuned or LoRA-adapted with customer data"; every account
  gets the same weights. The domain goes in through the state, instructions and criteria.
- **Versioning:** `jev-latest` points to `jev-1.13.0`. "An alias moves when a new release ships",
  so any thresholds we tune should be pinned to a version ID.
- **Data:** "We will not train or fine tune any ... models on your prompts or other Input." Retention
  is "as long as reasonably necessary". The services are "hosted in the United States"
  ([Privacy Policy](https://typesafe.ai/legal/privacy-policy), effective 2025-11-19). Zero data
  retention is "for enterprise customers" ([Legal](https://docs.typesafe.ai/legal)). The DPA sets no
  retention period ([DPA](https://typesafe.ai/legal/data-processing)).

### Known limits, from TypeSafe's own list ([Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13), reviewed 2026-09-17)

1. **Literal reading.** "Answers the question you wrote, not the one you meant."
2. **Maths and numbers.** "Jev is not a calculator." It "does not count reliably". It works better
   on "semantic representations than numeric", and Score levels cannot be interpolated into a
   magnitude.
3. **Dates.** Dates are read as text; code compares them.
4. **Indirection.** Multi-hop questions lose accuracy.
5. **Large, irrelevant state.** Accuracy falls, so filter in code first.
6. **Adversarial content.** Jev does not treat the state as hostile.
7. **Contradictory instructions and criteria.**
8. **No structural invariants.** A Noul and its negation need not sum to 1, and a Noul threshold does
   not carry over to a Choice.
9. **Generation.** "Not trained to generate text". For extraction, "extract possible options using
   regex or a generative model and let jev-1.13 pick"
   ([Pre-parsed value extraction](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook)).
   In function calling, "free text, numbers and dates ... no question, and the function's default
   stands" ([Function calling](https://docs.typesafe.ai/cookbooks/function_calling)).

---

## 2. Live tests (2026-09-25, `jev-1.13.0`)

**Method.** I wrote 8 suites of AEC-shaped questions with an answer key decided in advance.
- The main run went through every suite twice (182 requests). This measured accuracy and whether
  answers repeat.
- A "hard probes" run (44 requests) tried to break Jev on numbers, counting, crowded candidates,
  long state, Banglish and indirection.
- Each request was timed from this machine, with a fresh TLS connection unless stated.
- Cost is `input_tokens × $0.042/M`.

### 2.1 Speed and cost

| Measure | Value |
|---|---|
| Median wall-clock per request, fresh connection (226 requests) | **0.87 s** (p90 0.95 s; one outlier 3.9 s) |
| Median per request, warm keep-alive connection | **0.33 s** (range 0.30 to 0.37 s) |
| `GET /v1/models`, warm (network and TLS only, no model) | 0.25 s |
| 48 questions in one request (16 sheet titles × 3) | 1.38 s, 13.5k tokens, $0.00057 |
| 28 questions in one request (28 layer names) | 1.17 s, 10.2k tokens, $0.00043 |
| State padded with ~16.5k tokens of irrelevant notes | 1.3 to 1.5 s, $0.0007 |
| 20 one-question requests in parallel | 1.0 s wall-clock in total |
| Typical one-question request | 370 to 1,100 tokens, **$0.000016 to $0.000046** |
| **All 226 live requests** | **250,030 tokens, $0.0105** |

About 0.25 s of each call is the round trip from this machine to the US. Jev itself seems to take
roughly 0.05 to 0.1 s, which is in line with the homepage's 0.114 s claim. In production the server
should keep its connection warm and batch questions into one request.

### 2.2 Accuracy by suite (main run; both passes gave the same top answer everywhere except one low-confidence layer)

| Suite | What was asked | Correct | Notes |
|---|---|---|---|
| A. Sheet type + storey range, one request per sheet | 16 titles × {type, first storey, last storey} | **48/48** (both passes) | `TYPICAL FLOOR PLAN (2ND-8TH)` gave arch plan, 2nd to 8th, conf 0.94/1.0/1.0. `BEAM LAYOUT OF 1ST FLOOR SLAB` gave beam_layout, 1st to 1st. `1ST-10TH FLR. COL. LAYOUT` gave column_layout, 1st to 10th. `PLAN AT LEVEL +30'-0"` gave not_stated at **conf 0.36/0.41**, so the model said it did not know. |
| A'. The same 16 sheets in **one** request (48 questions) | same | 47/48 | `GRADE BEAM LAYOUT PLAN` last storey came back not_stated (conf 0.54). Batching cost one error. |
| B. Layer name to member type, one request each | 28 names | **27/28** | `clmn`, `colum`, `Column__X`, `S-COLS`, `SHEAR-WL`, `A-WALL-5in`, `10in wall`, `TXT_BEAM` (as text, not beam) and Bangla `দেয়াল` (wall) were all right. The miss was **`Kolam`** (phonetic "column"), answered unknown at conf 0.42. `bim` was right, but only at conf 0.46. |
| B'. The same 28 in one request | same | 25/28 | Batched, `bim` became unknown (0.28), `Kolam` became furniture then brick_wall (0.31), and `Layer1` became text (0.56). **The per-item state was more accurate than one large state.** |
| C. Choose the label for a geometry | 7 cases | **7/7** | This included "no candidate fits" (none, conf 0.45) and raw distances 950 mm against 1,050 mm (right, conf 0.90). |
| D. Ask routing: template + material + storey + unit + direction + % | 13 asks, 42 slots | **41/42** | All four slots of `total concrete on 3rd floor in cft` were right at 1.0. Bangla script `৩ তলায় কত ঘনফুট ঢালাই?` was right on all slots (0.97 to 0.99). **Miss:** Banglish `rod er dam 10% barle total koto barbe?` was routed to rod_by_diameter at **conf 0.77/0.80, confidently wrong**. Its slots (rod, increase, 10) were right. |
| E. Plausibility of a QS-typed value (Noul) | 19 values | 19/19 at a 0.5 cut | The unit slips were clear: 1,250 mm slab 0.03, 30.5 m storey 0.03, 200 mm cover 0.04. But **3000 psi scored 0.53, 95 Tk/kg rod 0.57 and 10 ft storey 0.58.** Plausible values hug 0.5 and give no margin. |
| F. General notes: pick a value from regex candidates | 10 fields | **10/10** | Covers (20/25/75 mm), f'c, fy, lap lengths (40d/50d), the 1:6 mix, and "stair waist not stated", all at conf 1.0. |
| G. Column schedule with Storey Bands | 3 lookups | **3/3** | "C2 on 5th", with the band "4th to 8th", gave 300x450 at 1.0. |
| H. Kind of Question for a finding | 4 | 4/4 | Code already knows which check failed, so this node does not need Jev (see §4). |

### 2.3 Hard probes: where it breaks

| Probe | Result |
|---|---|
| Counting: 18 labels, 12 start with C | **Wrong** (11, conf 0.26). This matches the docs. |
| Arithmetic as a Choice: 12 × 0.30×0.45×3.0 m³ among 5 options; 4.86 m³ to cft | Right (conf 0.78 and 0.99). **Do not rely on this.** The docs say to keep maths in code, and code is exact and free. |
| Plausibility near the edge | **150×150 mm column 0.52 and 950 Tk/kg rod 0.56**: both implausible, both passed. 55 Tk per cement bag 0.44 only just failed. 500 mm slab (0.05) and 1.5 m storey (0.03) were caught. **Jev is unfit as the range check.** |
| 12 label candidates with raw distances 480 against 520 mm | Right but conf **0.30**. When code turned the distances into a rank, the same case gave **conf 0.78**. Code should compute the geometry and give Jev ranks or buckets. |
| Title plus ~16k tokens of irrelevant notes | 9/9 right, conf ≥ 0.98. A short title survives long padding. |
| Compound Ask: "rod rises 8% and cement falls 3%" | The template was right (0.99), but one Choice holds one material: rod 0.67, cement 0.03. **Compound Asks need one Noul per option, or an LLM.** |
| Misspelt Ask: "total concreet 3rd flor cft" | All slots right, conf 1.0. |
| Banglish price-change Asks | "…10% barle total cost koto barbe?" gave cost_total (conf 0.38). "rod komle koto shasroy hobe 5% e?" gave quantity (0.56); its direction "decrease" was right (0.98). **Banglish what-if phrasing is Jev's weakest area here.** |
| Schedule indirection: floor not in any band; "floor directly above 3rd"; column absent | 3/3 (none 0.93, 300x450 1.0, none 1.0). |

### 2.4 Confidence gating (463 Choice answers, both passes plus probes; 15 wrong)

| Auto-accept if confidence ≥ | Auto-accepted | Wrong among them | Sent to the QS |
|---|---|---|---|
| 0.5 | 441 | 7 | 22 |
| 0.6 | 420 | 2 (both the Banglish what-if) | 43 |
| 0.8 | 382 | 1 | 81 |
| 0.9 | 349 | 0 | 114 |

Low confidence caught most errors, but not all: the Banglish miss came at 0.77 to 0.80. This fits
ADR 0007's pattern: propose, confirm in bulk, and route low-confidence items to one-by-one
Confirmation. It is **not** a licence to skip Confirmation.

**Caveat.** These are about 90 invented cases that I wrote, so the answer key is mine and the cases
are clean. They show capability, not field accuracy. Thresholds must be set on the Sample Project
and an Independent Set (ADR 0005), and pinned to `jev-1.13.0`.

---

## 3. Comparable System One approaches

| Approach | What it is | Strengths | Weaknesses for Vextrus |
|---|---|---|---|
| **Zero-shot NLI classifier** | An NLI model scores "this text entails label X" ([Yin, Hay & Roth 2019](https://arxiv.org/abs/1909.00161)), e.g. `facebook/bart-large-mnli`, 0.4B params, with a `multi_label` option ([model card](https://huggingface.co/facebook/bart-large-mnli)) | Self-hosted, no vendor, no data leaves | English-centric. Weak on abbreviations like `clmn`/`S-COLS`. Scores are not trained for calibration. We host and run it. |
| **Few-shot fine-tuned classifier (SetFit)** | Contrastive fine-tune of a sentence-transformer on a few labelled pairs, then a classification head. "Comparable results with PEFT and PET" with "orders of magnitude less parameters" ([Tunstall et al. 2022](https://arxiv.org/abs/2209.11055)) | Cheap, local and fast. **Every QS Confirmation is a free label**, so layer and BOQ-item mapping could move in-house later | Needs labelled data first, a model per task, and an MLOps burden |
| **Embeddings + kNN / logistic head** | Embed text and nearest-neighbour over confirmed examples; BGE-M3 covers "more than 100 working languages" and inputs up to 8,192 tokens ([Chen et al. 2024](https://arxiv.org/abs/2402.03216)) | Good for search and "same as a past item" (a Developer's item library, a consultant's layer habits). Multilingual. | Similarity is not a decision: no calibrated "none of these" and no instructions |
| **Small LLM with structured output** | Constrained decoding to a schema or regex ([Willard & Louf 2023, Outlines](https://arxiv.org/abs/2307.09702)), or a hosted model with `output_config.format` (Claude Haiku 4.5 at $1/$5 per MTok, Sonnet 5 at $2/$10; Claude API skill table, cached 2026-06-24) | Can extract and generate. Handles compound requests. | 24x (Haiku) to 95x (Opus 5.5) Jev's input price, plus output tokens. Seconds of latency. The schema guarantees shape, not truth. Can invent a value inside a valid schema. |
| **Rules, regex, dictionaries** (the baseline) | Code | Exact, free, testable | Brittle on drafter variety, which is why a judgment model is needed at all |

I measured none of the alternatives; the table rests on their papers. **Recommendation:** Jev is
the best-fitting default now. It has no training data needs, handles abbreviations and some Bangla,
is calibrated, costs cents per project, and sits behind one model seam. Plan SetFit or embeddings as
the fallback and second opinion once QS Confirmations have built a labelled corpus.

---

## 4. Node map for Vextrus

Legend: **Jev** = a System One judgment over candidates code has found. **Code** = deterministic.
**LLM** = System Two (Claude Opus 5.5), post-MVP unless stated. Every Jev node follows one pattern:
code finds the candidates and computes features, Jev picks with a confidence, and the QS confirms.
Low confidence goes to one-by-one Confirmation or a Question.

### Level 1: inside the Takeoff

| Node | Engine | Why / evidence |
|---|---|---|
| Parse DWG/DXF: entities, text, blocks, layers, title block region | Code | Geometry and parsing. Jev reads text only. |
| **Sheet classification** (discipline, sheet type) from title-block text | **Jev** Choice | Suite A 48/48, and the unclear title flagged itself (0.36). |
| **Sheet to storey range** | **Jev** Choice for first and last storey + code | 48/48. Code expands the range against the storey list and checks first ≤ last. |
| Storey list and heights (levels from sections and elevations) | Code, with a Jev pick | Code finds level texts (`+30'-0"`) and does the arithmetic. Jev only picks which text is a floor level mark. Dates and numbers go to code. |
| Grid | Code | Pure geometry. |
| **Layer to member type** | Dictionary + consultant memory (code) first, then **Jev** for unknown names | 27/28 single. Phonetic Banglish (`Kolam`) failed. Confirmed mappings are remembered per consultant, so Jev is rarely called twice for a name. |
| Block name to door/window/fixture | **Jev** Choice | Same shape as layers. |
| **Label to geometry binding** | Code (nearest same-kind label, one-to-one assignment) first, then **Jev** only for the ambiguous residue, fed ranks or buckets rather than raw mm | Suite C 7/7. The 12-candidate raw-distance case gave conf 0.30, the ranked version 0.78. |
| **Schedule reading** (column/beam schedules) | Code rebuilds the table cells from text positions. **Jev** reads header roles (size / bars / Storey Band) and band from-to. Code regexes `300x450` and `8-20Ø`. | Suite G 3/3 over bands. Jev must never produce a size, only pick one. |
| Bar callout interpretation (rod from the drawing, ADR 0010) | Code parses candidate readings. **Jev** picks among them (top/bottom/extra, which member). | Not tested. Uses the same select-not-generate pattern. |
| **General notes** (cover, f'c, fy, lap, mortar mix) | Regex candidates + **Jev** pick + a "not stated" option | Suite F 10/10 at conf 1.0. |
| Cross-sheet checks (schedule size against layout, missing label, missing row) | Code | These produce the Questions, and code knows which check fired. |
| Phrasing a Question to the QS | Code templates | Jev cannot generate. The check that fired selects the template (suite H shows Jev is unnecessary here). |
| **Parsing a QS's typed answer** ("5 in", "125mm", "৫ ইঞ্চি") | Regex + **Jev** Choice for the unit only when regex is unsure | Selection among units is Jev's strength; the value comes from regex. |
| Plausibility of a typed answer (125 mm against 1,250 mm) | **Code**: range per field held as data beside the Rule Set | Jev passed a 150×150 column (0.52) and 950 Tk/kg rod (0.56), and plausible values sat at 0.53 to 0.58. |
| Bulk Confirmation grouping ("86 match, 3 need you") | Code | Counting and comparison. |
| Measurement Rules → quantities; Rod Ratio; Rate Analysis; Material Schedule | Code | ADR 0009/0010: rules are data, code computes every number. |

### Level 2: the assistant over the confirmed dataset

| Node | Engine | Why / evidence |
|---|---|---|
| **Route the Ask to a query template** | **Jev** Choice | 12/13, plus 2 misses in the hard set, all Banglish what-ifs. Adding Banglish examples to the criteria is the first fix to try. |
| **Fill template slots** (material, storey, unit, direction) | **Jev** Choice, all slots in one request (speculative fan-out) | 41/42 slots, including Bangla script. |
| Numbers in the Ask (8%, 12 mm, B12) | Regex candidates + **Jev** pick | `pct` 3/3. Jev never types the number. |
| Resolve the entity ("beam B12 on 5th") | Code lookup, with **Jev** only to choose between look-alikes | Exact IDs are a lookup. |
| Run the query, what-if and totals | Code | "Code computes every number" (the owner's ruling). |
| Render the answer ("Concrete, 3rd floor: 1,234 cft, from 42 elements", with a Trace) | Code template | Jev cannot generate, and templates keep numbers honest. |
| "Why is this beam's volume this?" | Code: the Trace + the named Measurement Rules + the dimensions, rendered by a template | Deterministic. Nothing to reason about. |
| Show the parsed Ask as editable chips ("Concrete · 3rd floor · cft") when confidence is low | Code UI + Jev confidence | The quiet way to handle the 0.5 to 0.8 band. |
| Compound or open questions ("rod +8% and cement −3%", "which floor is over and why?") | MVP: one **Jev** Noul per material for the compound case; anything open is "not supported yet", with suggestions. Post-MVP: **LLM** calling the same code query functions. | One Choice cannot hold two materials (probe). |

### "Quiet intelligence" across the product (Jev inside ordinary nodes, not a chat)

| Node | Engine |
|---|---|
| Upload triage: which files are structural, architectural or MEP, and which are superseded revisions (filename + title text) | **Jev** |
| Price-list import (a Developer's Excel): which column is item, unit or rate | **Jev** Choice per header |
| Match a price-list line ("BSRM 500W rod") to a Resource | **Jev** Choice over a code shortlist (rerank pattern; Choice ≤ 255 options, hierarchical above that) |
| Map confirmed elements to the **Developer's own BOQ item library and Rate Analysis items** | Code shortlist (embeddings or keywords) + **Jev** Choice + a "no matching item" option |
| Search box ("the 5th floor slab beams", "C2 schedule") | Code candidates + **Jev** rerank |
| Revision block reading (REV no., "issued for construction") | **Jev** pick. The revision diff itself is code. |
| Drawing units (mm against inch), rod-per-cft outliers, cost anomalies against benchmarks | Code (ratios and numbers) |
| Consultant memory ("this consultant's `clmn` = column") | Code (stored confirmations; no AI once learned) |

### What genuinely needs a System Two LLM

| Node | Why Jev cannot do it |
|---|---|
| **Revision comparison as a job** (Level 3): read two sets, reconcile the changed elements, write the impact narrative | Multi-step, open-ended, generative |
| Reading **raster or scanned PDFs** (a Drawing Set with no DWG) | Jev is text only. This needs vision (LLM) or an OCR engine first. **If the MVP must accept PDF-only sets, this is an MVP dependency.** |
| Open-ended Asks beyond the templates; advice ("how could we cut rod?") | Composes several queries and generates prose. Numbers still come from code tools. |
| Drafting letters, RFIs to the consultant, tender text | Generation |
| Turning a Developer's written measurement practice into Rule Set data | Reading prose into structure, then QS confirmation |

---

## 5. Cost per project Takeoff at MVP scale (estimate, not measured)

Assumptions: a G+9 Dhaka RCC building; about 60 sheets; about 150 layers; about 3,000 labels, of
which code binds 80%; 20 schedules; 5 notes sheets; about 2,000 bar callouts; about 200 element-type
to BOQ-item mappings; 500 Asks over the project's life. Token sizes are the measured ones.

| Work | Calls | Tokens |
|---|---|---|
| Sheets (3 questions each) | 60 | 66k |
| Layers and blocks | 200 | 130k |
| Label binding residue (up to 12 candidates) | 600 | 600k |
| Schedules and notes | 25 | 75k |
| Bar callouts (rod from the drawing) | 2,000 | 1.4M |
| BOQ item and Resource mapping | 300 | 900k |
| Asks | 500 | 600k |
| **Subtotal**, ×3 for re-reads after edits and revisions | ~11k | **~11M** |

- **Jev: about 11M × $0.042/M ≈ $0.46 per project.** At 10x the assumptions it is still under $5.
  The throughput cap of 1,200 requests/min means about 4,000 calls take about 3 to 4 minutes at 20
  in parallel, fewer if questions are batched.
- **The same token volume on Claude Opus 5.5** ($4 in / $20 out per MTok) would be about $44 of
  input alone, before output and thinking tokens, with seconds per call. On Haiku 4.5 it would be
  about $11 plus output. Jev's cost is negligible; **the cost that matters is the QS's time on
  low-confidence items.**

---

## 6. Risks

| Risk | Evidence | Mitigation |
|---|---|---|
| **Vendor dependence on a young company** | One model family (jev-1.13). Same weights for everyone, no fine-tuning. "Limits ... can change without notice". No public pricing page. | One model seam. Pin `jev-1.13.0`. Record fixtures, so tests run offline. Build a fallback: consultant memory + dictionaries (code), then SetFit or embeddings trained on accumulated Confirmations. |
| **Availability** | 429 and 529 codes documented; round trip from Bangladesh to the US ≈ 0.25 s | Retries with backoff. **The Takeoff must degrade to "the QS picks from the candidates", never stop.** Batch questions per request. |
| **Model drift** | "An alias moves when a new release ships" | Pin versions. Re-run the evaluation set before moving; thresholds belong to a version. |
| **Data privacy: what goes to TypeSafe** | Title-block text, layer and block names, label texts with code-computed features, notes and schedule text, Ask text, and QS-typed values. **Not** the DWG files or geometry. The service is hosted in the US; there is no training on inputs; retention is unspecified; ZDR is enterprise only. | A Developer's and its consultant's drawing content is commercially sensitive. Tell clients in the terms of service. Send only the fields each question needs (this also helps accuracy). Ask TypeSafe for a written retention period, or ZDR, before the first paying client. **Sending Independent-Set (Edison) text to TypeSafe is the owner's call.** |
| **Language** | "English primary". Tests: Bangla script fine; phonetic Banglish (`Kolam`) and Banglish what-ifs failed | Bilingual criteria with transliteration examples. Chips UI to correct the parse. Log the misses as the evaluation set. |
| **Silent confident errors** | The Banglish what-if was wrong at conf 0.77 to 0.80 | Nothing Jev says counts until Confirmation (ADR 0007). Interpreted Asks are always shown back as chips. |
| **Numbers** | The plausibility and counting failures above | No number is ever produced or judged by Jev; code does both. |

---

## 7. What I don't know

- Field accuracy on real drafting habits. These cases are invented by me and clean. The Sample
  Project and an Independent Set must supply the evaluation set.
- TypeSafe's actual retention period, the list of subprocessors (trust.typesafe.ai did not render),
  commercial terms and any volume pricing.
- Whether Jev copes with a real title block's full text (address, consultant name, revision table),
  rather than the title line alone. The padding probe suggests yes, but I did not test it.
- I did not measure the alternatives (§3).
