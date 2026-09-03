// R-SPINE-060: the upload pattern's own table. Copy fixed verbatim by docs/design/dropzone.md § 3;
// the queue's five state words are the five states a row can stand in, and nothing here says a
// sentence about a refusal — that copy belongs to the register (R-SPINE-062).
export const dropzone = {
  dropzone_prompt: "Drop drawings here to upload them. A folder or a .zip archive works too.",
  dropzone_browse: "Choose files",
  dropzone_browse_folder: "Choose a folder",
  dropzone_accepts: "DWG, DXF, PDF, PNG, JPG and TIFF, up to 500 MB per file. A .zip is expanded into the drawings it holds.",
  dropzone_state_queued: "Queued",
  dropzone_state_uploading: "Uploading",
  dropzone_state_stored: "Stored",
  dropzone_state_duplicate: "Already stored",
  dropzone_state_refused: "Refused",
  dropzone_evidence_formats: "See the accepted formats",
} as const;
