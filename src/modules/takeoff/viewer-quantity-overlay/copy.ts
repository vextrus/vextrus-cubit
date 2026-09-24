// The sentences the quantity legend says, BY KEY (Decision Part 6, I-636).
//
// `src/modules` may not import `src/ui/strings` (ARCH-01), and a mirror of the registry is a second home
// that can drift (the debt I-113 records). So this file holds no sentence at all: it names the keys the
// legend reads, and the screen hands the legend the registry's own values under exactly these keys —
// `src/ui/strings/viewer.ts` is the one home, and a key it does not carry is a compile error at the
// screen that builds the record.

/** The keys of `src/ui/strings/viewer.ts` the legend and its switches say. */
export const QUANTITY_COPY_KEYS = [
  "viewer_quantity_legend_label",
  "viewer_quantity_legend_heading",
  "viewer_quantity_measured_scope",
  "viewer_quantity_measured_scope_note",
  "viewer_quantity_unmeasured_heading",
  "viewer_quantity_unmeasured_count",
  "viewer_quantity_omitted",
  "viewer_quantity_bases_heading",
  "viewer_quantity_elsewhere_heading",
  "viewer_quantity_elsewhere_row",
  "viewer_quantity_loading",
  "viewer_quantity_empty",
  "viewer_quantity_failed",
  "viewer_quantity_retry",
  "viewer_quantity_report_id",
] as const;

export type QuantityCopyKey = (typeof QUANTITY_COPY_KEYS)[number];

/** The registry's sentences, under the keys above, as the screen hands them in. */
export type QuantityCopy = Readonly<Record<QuantityCopyKey, string>>;

/** A sentence with its `{name}` placeholders filled — the registry's own `fill` convention. */
export function fillCopy(sentence: string, values: Readonly<Record<string, string>>): string {
  return sentence.replace(/\{(\w+)\}/gu, (whole, name: string) => values[name] ?? whole);
}
