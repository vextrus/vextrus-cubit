// The scale a view's caption PRINTS — "STIRRUP HOOK DETAIL  SCALE 1:20" — read as data a QS is shown,
// never as evidence a factor is derived from (L-MEA-05: "Printed scale notes are not evidence at any
// rank"; I-418, I-565). A caption is a claim about how the view was drawn; the drawing's own
// grid, dimensions, header or a person's two points are what a scale stands on. The panel names the
// printed scale beside the view so a reader who meets "only a two-point calibration can scale it"
// knows the caption was read, and can check a two-point result against it by eye.

/** "SCALE 1:20", "SCALE = 1 : 20", "SCALE-1:100", "SCL 1:50" — the note's word, then a 1:N ratio. */
const PRINTED_SCALE = /\b(?:SCALE|SCL)\s*[:=-]?\s*1\s*:\s*(\d+(?:\.\d+)?)(?![\d.:])/giu;

/**
 * The ratio a caption prints, spelled `1:N`, or null where it prints none — or prints two that
 * disagree, because which of them the view was drawn at is not this reader's to decide (L-QTY-04).
 * A ratio of zero or a leading-zero spelling reads as printed text, never as a number to correct.
 */
export function printedScaleOf(caption: string): string | null {
  const ratios = new Set<string>();
  for (const match of caption.matchAll(PRINTED_SCALE)) {
    const denominator = match[1];
    if (denominator === undefined || /^0+(?:\.0*)?$/u.test(denominator)) continue;
    ratios.add(`1:${denominator}`);
  }
  if (ratios.size !== 1) return null;
  const [only] = ratios;
  return only ?? null;
}
