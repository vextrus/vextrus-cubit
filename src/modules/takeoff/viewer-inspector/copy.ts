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
// Recorded as an ownership request in the increment's handoff: the cure is a copy home both layers
// may read, which no layer of ARCH-01's matrix offers today.

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

/**
 * A mirrored string with its named slots filled, the registry's own substitution rule: a slot the
 * caller has no value for is left standing as itself rather than becoming the word "undefined" on a
 * screen (R-SPINE-060, mirrored here for the same reason the table above is).
 */
export function fillCopy(key: InspectorCopyKey, values: Readonly<Record<string, string>>): string {
  return INSPECTOR_COPY[key].replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}
