/**
 * AC-2 — the deterministic caption grammar classifies the committed corpus, and never guesses.
 *
 * The corpus is the subject and the expectation both: every entry of every
 * `fixtures/view-captions/*.json` states the caption and the type it is classified as, and the
 * grammar is held to the whole file rather than to a list retyped here — a corpus that grows an
 * entry grows the expectation with it (B-19). What is pinned is what AC-2 itself defines: the
 * canonical pairs the spec names, and that the corpus covers the whole vocabulary bar UNASSIGNED,
 * which no caption can anchor because it is what a view with no caption at all is.
 *
 * Silence is the other half. A caption the grammar cannot read is answered UNTYPED with the reason
 * `CAPTION_UNCLASSIFIABLE` — read from the register, never spelled as a bare literal by the grammar
 * — because a grammar that guessed would put a wrong view type in front of a person as if it were
 * read off the drawing.
 */
import { describe, expect, test } from "vitest";
import { CAPTION_UNCLASSIFIABLE, ERRORS_MODULE, UNASSIGNED, captionCorpus, grammar, productModule, viewsLaw, type CaptionEntry, type ErrorsSeam, type GrammarSeam, type ViewsLaw } from "./support/partition-stage";

/** The type an unreadable caption is answered with (AC-2). */
const UNTYPED = "UNTYPED";

/** The canonical pairs AC-2 names, caption by caption. */
const CANONICAL: readonly (readonly [string, string])[] = [
  ["TYPICAL FLOOR PLAN", "LAYOUT_PLAN"],
  ["GROUND FLOOR PLAN", "LAYOUT_PLAN"],
  ["COLUMN SCHEDULE", "SCHEDULE"],
  ["LONGITUDINAL SECTION OF BEAM B1", "LONG_SECTION_STRIP"],
  ["SECTION A-A", "MEMBER_SECTION"],
  ["TYPICAL DETAIL OF FOOTING", "DETAIL"],
  ["FOOTING F1 PLAN", "DETAIL"],
  ["STAIR PLAN", "STAIR_PLAN"],
  ["SECTION THROUGH STAIR", "STAIR_SECTION"],
  ["GENERAL NOTES", "LEGEND_NOTES"],
  ["LEGEND", "LEGEND_NOTES"],
  ["DRAWING TITLE", "TITLE"],
  ["XQZ 77", UNTYPED],
  ["", UNTYPED],
];

/** The escapes a DXF caption carries, which say nothing about what the view is (AC-2). */
const ESCAPES = ["%%U", "%%O", "%%C", "%%D", "%%P"];

/**
 * Captions this test writes rather than reads: none of them is in the corpus, and none is a case,
 * whitespace or escape variant of a corpus entry (the test below proves that against the committed
 * files). Each is read by the SAME rule the corpus entry beside it is read by — a stair's plan and
 * section before the general ones, the words that name a kind of drawing outright, a member-scoped
 * plan before a layout plan, a long section before a member's own — so a classifier that had merely
 * memorised the corpus answers every one of them wrongly, while the stated grammar answers them all.
 */
const UNSEEN: readonly (readonly [string, string])[] = [
  ["PLAN OF STAIR AT BLOCK C", "STAIR_PLAN"],
  ["STAIR SECTION AT GRID 4", "STAIR_SECTION"],
  ["BEAM SCHEDULE", "SCHEDULE"],
  ["STRUCTURAL NOTES", "LEGEND_NOTES"],
  ["SHEET TITLE", "TITLE"],
  ["DETAIL AT SLAB EDGE", "DETAIL"],
  ["LONGITUDINAL SECTION OF COLUMN C2", "LONG_SECTION_STRIP"],
  ["PLAN OF FOOTING F7", "DETAIL"],
  ["FIRST FLOOR PLAN", "LAYOUT_PLAN"],
  ["SECTION B-B", "MEMBER_SECTION"],
  ["ZQ-4471", UNTYPED],
];

/** A caption as the grammar is told to read one: escapes gone, whitespace collapsed, case levelled. */
function normalised(caption: string): string {
  return ESCAPES.reduce((text, escape) => text.split(escape).join(""), caption.toUpperCase()).replace(/\s+/g, " ").trim();
}

/** What the grammar owes for one corpus entry. */
function owed(entry: CaptionEntry): { type: string; reason: string | null } {
  return entry.type === UNTYPED ? { type: UNTYPED, reason: CAPTION_UNCLASSIFIABLE } : { type: entry.type, reason: null };
}

let staging: Promise<{ grammar: GrammarSeam; law: ViewsLaw; corpus: CaptionEntry[] }> | undefined;
const staged = (): Promise<{ grammar: GrammarSeam; law: ViewsLaw; corpus: CaptionEntry[] }> =>
  (staging ??= (async () => ({ grammar: await grammar(), law: await viewsLaw(), corpus: captionCorpus() }))());

describe("AC-2: the corpus is a corpus", () => {
  test("AC-2: the committed corpus is non-empty and covers every view type a caption can anchor", async () => {
    const { law, corpus } = await staged();
    expect(corpus.length, "fixtures/view-captions holds entries — a grammar graded on nothing is graded on nothing").toBeGreaterThan(0);

    const covered = new Set(corpus.map((entry) => entry.type));
    const owedTypes = law.VIEW_TYPES.filter((member) => member !== UNASSIGNED);
    expect(
      owedTypes.filter((member) => !covered.has(member)),
      "every member of the vocabulary but UNASSIGNED has at least one caption in the corpus — UNASSIGNED is what a view with no caption is, so no caption can say it",
    ).toEqual([]);

    const stray = [...covered].filter((type) => !law.VIEW_TYPES.includes(type));
    expect(stray, "a corpus entry claims a type the vocabulary does not hold").toEqual([]);
  });

  test("AC-2: the corpus states the canonical pairs the spec names", async () => {
    const { corpus } = await staged();
    const said = new Map(corpus.map((entry) => [entry.caption, entry.type]));
    for (const [caption, type] of CANONICAL) {
      expect(said.get(caption), `the corpus states ${JSON.stringify(caption)} as ${type}`).toBe(type);
    }
  });
});

describe("AC-2: the grammar classifies the corpus and answers UNTYPED where it is silent", () => {
  test("AC-2: every corpus entry is answered exactly as the corpus states it", async () => {
    const { grammar: seam, corpus } = await staged();
    const wrong = corpus
      .map((entry) => ({ entry, got: seam.classifyCaption(entry.caption) }))
      .filter(({ entry, got }) => got.type !== owed(entry).type || got.reason !== owed(entry).reason)
      .map(({ entry, got }) => `${entry.file}: ${JSON.stringify(entry.caption)} → ${JSON.stringify(got)}, owed ${JSON.stringify(owed(entry))}`);
    expect(wrong, "the grammar reads the committed corpus exactly — a classifiable caption carries no reason, and a silent one is UNTYPED with the reason it was silent").toEqual([]);
  });

  test("AC-2: escapes, case and surrounding whitespace never change the answer", async () => {
    const { grammar: seam, corpus } = await staged();
    const changed: string[] = [];
    for (const entry of corpus) {
      const base = owed(entry);
      const variants = [
        `  ${entry.caption}  `,
        entry.caption.toLowerCase(),
        `\t${entry.caption.toLowerCase()}\n`,
        ...ESCAPES.map((escape) => `${escape}${entry.caption}${escape}`),
        `${ESCAPES.join("")}${entry.caption}`,
      ];
      for (const variant of variants) {
        const got = seam.classifyCaption(variant);
        if (got.type !== base.type || got.reason !== base.reason) {
          changed.push(`${JSON.stringify(variant)} → ${JSON.stringify(got)}, owed ${JSON.stringify(base)} (from ${JSON.stringify(entry.caption)})`);
        }
      }
    }
    expect(changed, "a caption is normalised before it is read: the escapes are stripped, whitespace collapses and case does not decide what a view is").toEqual([]);
  });

  test("AC-2: a caption the corpus never states is answered by the rule that reads it", async () => {
    const { grammar: seam, corpus } = await staged();

    // The premise first: an answer to a caption the corpus already holds proves memory, not grammar.
    const said = new Set(corpus.map((entry) => normalised(entry.caption)));
    const seen = UNSEEN.filter(([caption]) => said.has(normalised(caption))).map(([caption]) => caption);
    expect(seen, "these captions are asked BECAUSE the corpus does not state them — one the corpus states is answered by looking it up").toEqual([]);

    // And the coverage the corpus itself defines: every class a caption can say is asked for by a
    // caption the corpus does not say, so no class is graded by lookup alone (B-19).
    const classes = new Set(corpus.map((entry) => entry.type));
    const asked = new Set(UNSEEN.map(([, type]) => type));
    expect(
      [...classes].filter((type) => !asked.has(type)),
      "every class the corpus covers is also asked of a caption the corpus does not hold",
    ).toEqual([]);

    const wrong: string[] = [];
    for (const [caption, type] of UNSEEN) {
      const owedAnswer = { type, reason: type === UNTYPED ? CAPTION_UNCLASSIFIABLE : null };
      for (const variant of [caption, `  ${caption.toLowerCase()}  `, `%%U${caption}%%O`]) {
        const got = seam.classifyCaption(variant);
        if (got.type !== owedAnswer.type || got.reason !== owedAnswer.reason) {
          wrong.push(`${JSON.stringify(variant)} → ${JSON.stringify(got)}, owed ${JSON.stringify(owedAnswer)}`);
        }
      }
    }
    expect(
      wrong,
      "the grammar reads a caption by its words — a stair's plan and section first, then the words that name a kind of drawing, a member-scoped plan before a layout plan, and a section that names neither is a member's own — so a caption written on a drawing it has never seen is classified rather than shrugged at",
    ).toEqual([]);
  });

  test("AC-2: every class the grammar answers with is a member of the vocabulary", async () => {
    const { grammar: seam, law } = await staged();
    const answered = UNSEEN.map(([caption]) => seam.classifyCaption(caption).type);
    expect(
      answered.filter((type) => !law.VIEW_TYPES.includes(type)),
      "a classification names a member of the closed vocabulary and nothing else (L-CAD-06)",
    ).toEqual([]);
  });

  test("AC-2: CAPTION_UNCLASSIFIABLE is a registered refusal, and the reason is read from it", async () => {
    const errors = await productModule<ErrorsSeam>(ERRORS_MODULE);
    const entry = errors.REFUSALS[CAPTION_UNCLASSIFIABLE];
    expect(entry, `${CAPTION_UNCLASSIFIABLE} is a registered refusal — the reason a view carries is a code the register holds (Q-07, R-UI-020)`).toBeTruthy();
    expect((entry as { code: string }).code, "the entry is keyed by its own code").toBe(CAPTION_UNCLASSIFIABLE);
    expect((entry as { message: string }).message.length, "the refusal says in one sentence what was refused").toBeGreaterThan(0);
    expect((entry as { remedy: string }).remedy.length, "the refusal says in one sentence what resolves it").toBeGreaterThan(0);

    const { grammar: seam } = await staged();
    expect(seam.classifyCaption("XQZ 77").reason, "the grammar's reason IS the registered code, not a second spelling of it").toBe((entry as { code: string }).code);
  });
});
