// The sentences the inspector panel says, mirrored from their home in the registry.
//
// `src/modules` imports core and its own module only (ARCH-01), and the string registry is
// `src/ui/strings` — so a panel that lives in this module cannot read its copy from the table that
// owns it. The tree's answer to that boundary is a mirror pinned by a test rather than an
// improvisation at the render site: `src/ui/screen-states/refusal-entries.ts` mirrors the refusal
// register the same way, for the same reason. Every value below is `src/ui/strings/viewer-inspector.ts`
// verbatim, and tests/takeoff/viewer-inspector/copy-mirror.test.ts fails the build if the two ever
// differ (B-17's boundary friction, C-13).
//
// The cure — a copy home both layers may read — is recorded with its owner in
// docs/design/s-viewer-inspector.md § 8, never as a promise left in this tree (B-17, Q-17).

/** The keys of the registry this panel renders. */
export type InspectorCopyKey =
  | "viewer_inspector_heading"
  | "viewer_inspector_idle_heading"
  | "viewer_inspector_idle_body"
  | "viewer_inspector_hover_type"
  | "viewer_inspector_hover_layer"
  | "viewer_inspector_hover_handle"
  | "viewer_inspector_key"
  | "viewer_inspector_copy"
  | "viewer_inspector_copy_label"
  | "viewer_inspector_copied"
  | "viewer_inspector_reveal"
  | "viewer_inspector_clear"
  | "viewer_inspector_selected_count"
  | "viewer_inspector_missing_heading"
  | "viewer_inspector_missing_body";

export const INSPECTOR_COPY: Readonly<Record<InspectorCopyKey, string>> = Object.freeze({
  viewer_inspector_heading: "Inspector",
  viewer_inspector_idle_heading: "Nothing selected",
  viewer_inspector_idle_body:
    "Hover an entity to read it. Click to select; Shift and drag to select a rectangle; Select on a layer row takes the whole layer.",
  viewer_inspector_hover_type: "Type",
  viewer_inspector_hover_layer: "Layer",
  viewer_inspector_hover_handle: "Handle",
  viewer_inspector_key: "Source key",
  viewer_inspector_copy: "Copy key",
  viewer_inspector_copy_label: "Copy {key}",
  viewer_inspector_copied: "Copied",
  viewer_inspector_reveal: "Reveal in sheet",
  viewer_inspector_clear: "Clear selection",
  viewer_inspector_selected_count: "{count} selected",
  viewer_inspector_missing_heading: "Not on this sheet",
  viewer_inspector_missing_body: "The link named these keys, and this sheet does not hold them.",
});

/** The keys of the Trace's own registry — `src/ui/strings/trace.ts`, mirrored for the same reason. */
export type TraceCopyKey =
  | "trace_heading"
  | "trace_formula_label"
  | "trace_variables_label"
  | "trace_origin"
  | "trace_missing"
  | "trace_failed"
  | "trace_retry"
  | "trace_cited_heading"
  | "trace_cited_count"
  | "trace_cited_none"
  | "trace_cited_failed";

/**
 * The Trace's and the Cited-by block's sentences (R-UI-022, X-2). A SEPARATE table from the panel's
 * own: the two are mirrored from two different registry files, and one table over both would pin a
 * key against a home that does not hold it.
 */
export const TRACE_COPY: Readonly<Record<TraceCopyKey, string>> = Object.freeze({
  trace_heading: "Trace",
  trace_formula_label: "Formula",
  trace_variables_label: "Variables",
  trace_origin: "Back to the register line",
  trace_missing: "This project holds no line by that id.",
  trace_failed: "The line could not be read.",
  trace_retry: "Read again",
  trace_cited_heading: "Cited by",
  trace_cited_count: "{count} lines cite this selection",
  trace_cited_none: "No published line cites this selection.",
  trace_cited_failed: "The lines citing this selection could not be read.",
});

/**
 * A mirrored string with its named slots filled, the registry's own substitution rule: a slot the
 * caller has no value for is left standing as itself rather than becoming the word "undefined" on a
 * screen (R-SPINE-060, mirrored here for the same reason the table above is).
 */
export function fillCopy(key: InspectorCopyKey, values: Readonly<Record<string, string>>): string {
  return fillSlots(INSPECTOR_COPY[key], values);
}

/** The same substitution over the Trace's own table. */
export function fillTrace(key: TraceCopyKey, values: Readonly<Record<string, string>>): string {
  return fillSlots(TRACE_COPY[key], values);
}

function fillSlots(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}
