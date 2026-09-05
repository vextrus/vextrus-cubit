// R-SPINE-060: the inspector region of S-Viewer, as its own module table. Copy fixed verbatim by
// docs/design/s-viewer-inspector.md § 3 — the panel's heading and idle teaching, the three hover
// labels, the source-key line and its copy door, the two selection doors, the count sentence, the
// partial cell for keys this sheet does not hold, and the two words the layers panel and the status
// readout gain.
//
// Types, layer names, handles and source keys are model data: they render verbatim beside these
// words and never inside a sentence (I-25, I-26).
export const viewerInspector = {
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
  viewer_status_selection: "Selection",
  viewer_layer_select: "Select",
  viewer_layer_select_label: "Select every entity on {layer}",
} as const;

// The directory's convention is that a table is exported under its file's basename, and this file's
// basename is hyphenated (tests/ui/strings.test.ts).
export { viewerInspector as "viewer-inspector" };
