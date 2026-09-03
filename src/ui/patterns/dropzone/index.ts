/**
 * The upload pattern (R-SPINE-020, R-UI-011): the one place a person hands drawings to the product,
 * and the client that carries them there. Every surface that takes drawings opens this one — a
 * second dropzone is a second protocol (B-17, ARCH-02).
 *
 * Importing it brings its stylesheet and the reticle's single home (R-UI-012), so no consumer can
 * render the pattern unstyled or its doors unfocusable.
 */
import "../../primitives/core/reticle.css";
import "./dropzone.css";

export { Dropzone } from "./dropzone";
export type { DropzoneFile, DropzoneItem, DropzoneItemState, DropzoneProps } from "./dropzone";
export { uploadFiles } from "./upload-client";
export type { FetchLike, SkippedUpload, UploadedDrawing, UploadOptions, UploadOutcome, UploadProgress } from "./upload-client";
