// R-SPINE-020's upload seam, published: the three operations a transfer is made of, the hook an
// installation scans through, the rosters and ceilings the protocol states, and the archive reader.
// A caller — a route, a screen's server action, a worker — speaks to the seam through this file and
// never reaches past it (ARCH-02).
export { UPLOAD_CHUNK_BYTES, UPLOAD_MAX_BYTES, ACCEPTED_FORMATS, type AcceptedFormat, type ScanVerdict, type UploadState } from "../../../core/uploads";
export { declaredFormat, detectFormat, isArchiveContent, isArchiveName, FORMAT_HEAD_BYTES } from "./formats";
export type { UploadRefusalCode } from "./refusals";
export { setUploadScanner, type ScanAnswer, type UploadScanner } from "./scanner";
export { stagingPath, storageRoot, uploadStorage } from "./storage";
export { expandZip, type SkippedMember, type ZipExpansion, type ZipMember } from "./zip";
export {
  appendChunk,
  createUpload,
  isRefused,
  workspaceOfProject,
  workspaceOfUpload,
  uploadStatus,
  type AppendChunkRequest,
  type CreateUploadRequest,
  type RecordedDrawing,
  type UploadActor,
  type UploadAdvanced,
  type UploadOpened,
  type UploadOutcome,
  type UploadProbe,
  type UploadRefused,
  type UploadStatusRequest,
} from "./session";
