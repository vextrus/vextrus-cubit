"use client";
/**
 * R-SPINE-020's gathering pattern, and its one home (B-17): every surface that takes drawings from a
 * person opens this — drag-and-drop, the file picker and the folder picker, with the queue of what
 * was gathered and what became of each row.
 *
 * It performs no request of its own. `onFiles` hands the consumer what arrived, under the path it
 * arrived with, and the rows come back as `items`: the pattern renders exactly what it is given, in
 * the order it is given, and invents no tally, no fraction and no sentence (Decision I-70, I-74).
 *
 * ARCH-01: `RefusalEntry` arrives as a type and every number a row shows is text the consumer
 * formatted through the format seam — this layer value-imports nothing outside itself.
 */
import { useId, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import type { RefusalEntry } from "../../../core/errors";
import { Button } from "../../primitives/core";
import { RefusalState } from "../refusal-state";
import { strings } from "../../strings";

/** Where a row stands. Five states, and a row is always in exactly one of them (Decision § 2). */
export type DropzoneItemState = "queued" | "uploading" | "stored" | "duplicate" | "refused";

/** One row of the queue, as the consumer composes it (increment interfaces). */
export interface DropzoneItem {
  /** The path the file arrived under — a folder drop's relative path, or an archive member's. */
  name: string;
  /** The progress line, formatted by the consumer through SEAM-FORMAT and rendered verbatim (I-70). */
  progress: string;
  state: DropzoneItemState;
  /** The registered refusal a `refused` row renders; the pattern writes no prose beside it (I-72). */
  refusal?: RefusalEntry;
}

/** One file as the pattern reports it: the path it arrived under, and the file itself. */
export interface DropzoneFile {
  name: string;
  file: File;
}

export interface DropzoneProps {
  /** Called once per gesture with everything it gathered, whichever door it came through. */
  onFiles: (files: DropzoneFile[]) => void;
  items: DropzoneItem[];
  /** What the pickers offer, as the `accept` attribute spells it. */
  accept?: string;
}

/** The state word each row wears, from the one table that holds this pattern's copy (R-SPINE-060). */
const STATE_WORDS: Readonly<Record<DropzoneItemState, string>> = {
  queued: strings.dropzone_state_queued,
  uploading: strings.dropzone_state_uploading,
  stored: strings.dropzone_state_stored,
  duplicate: strings.dropzone_state_duplicate,
  refused: strings.dropzone_state_refused,
};

/**
 * The path a file arrived under. A folder drop and the folder picker both set `webkitRelativePath`,
 * and that path is drawing information: which folder a sheet came out of is not noise to be trimmed
 * off (Decision § 1).
 */
function pathOf(file: File): string {
  const relative = file.webkitRelativePath;
  return typeof relative === "string" && relative !== "" ? relative : file.name;
}

/** Everything a drop or a picker carried, in the order the browser listed it. */
function gathered(list: FileList | readonly File[] | null | undefined): DropzoneFile[] {
  return Array.from(list ?? []).map((file) => ({ name: pathOf(file), file }));
}

export function Dropzone({ onFiles, items, accept }: DropzoneProps) {
  // I-76: enter and leave are counted, so crossing a child's boundary does not flicker the paint
  // back to idle while the drag is still over the pattern.
  const [dragDepth, setDragDepth] = useState(0);
  const acceptsId = useId();
  const fileDoor = useRef<HTMLInputElement>(null);
  const folderDoor = useRef<HTMLInputElement>(null);

  const report = (files: DropzoneFile[]): void => {
    if (files.length > 0) onFiles(files);
  };

  const onDragEnter = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragDepth((depth) => depth + 1);
  };

  // Prevented so the browser does not navigate away to the file that was dropped — the classic
  // silent data loss (I-76).
  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
  };

  const onDragLeave = (): void => {
    setDragDepth((depth) => (depth > 0 ? depth - 1 : 0));
  };

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setDragDepth(0);
    report(gathered(event.dataTransfer?.files));
  };

  const onPicked = (event: ChangeEvent<HTMLInputElement>): void => {
    report(gathered(event.target.files));
    // The same file chosen twice in a row is two gestures, and a picker that kept its value would
    // report the second as nothing at all.
    event.target.value = "";
  };

  return (
    <section
      className="cx-dropzone"
      data-testid="dropzone"
      data-state={dragDepth > 0 ? "dragging" : "idle"}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="cx-dropzone-zone">
        <p className="cx-dropzone-prompt">{strings.dropzone_prompt}</p>
        <div className="cx-dropzone-doors">
          <Button variant="secondary" data-testid="dropzone-browse" onClick={() => fileDoor.current?.click()}>
            {strings.dropzone_browse}
          </Button>
          <Button variant="ghost" onClick={() => folderDoor.current?.click()}>
            {strings.dropzone_browse_folder}
          </Button>
        </div>
        <p id={acceptsId} className="cx-dropzone-accepts">
          {strings.dropzone_accepts}
        </p>
        {/* I-71: the pickers are hidden inputs behind real Buttons — one tab stop per door, and the
            focus ring is the reticle's, drawn on the Button it belongs to. */}
        <input
          ref={fileDoor}
          className="cx-dropzone-door-input"
          data-testid="dropzone-input"
          type="file"
          multiple
          accept={accept}
          tabIndex={-1}
          aria-hidden="true"
          onChange={onPicked}
        />
        <input
          ref={folderDoor}
          className="cx-dropzone-door-input"
          data-testid="dropzone-folder-input"
          type="file"
          multiple
          accept={accept}
          tabIndex={-1}
          aria-hidden="true"
          onChange={onPicked}
          {...FOLDER_DOOR}
        />
      </div>
      {items.length > 0 ? (
        <ul className="cx-dropzone-queue">
          {items.map((item, index) => (
            <li className="cx-dropzone-item" data-testid="dropzone-item" data-name={item.name} data-state={item.state} key={`${item.name}:${index}`}>
              <p className="cx-dropzone-item-name" dir="ltr">
                {item.name}
              </p>{" "}
              {/* I-73: the live region is the state word, which changes at most four times per row —
                  never the progress line, which would announce every chunk. */}
              <span className="cx-dropzone-item-state" aria-live="polite">
                {STATE_WORDS[item.state]}
              </span>{" "}
              <span className="cx-dropzone-item-progress" data-testid="dropzone-item-progress">
                {item.progress}
              </span>
              {item.state === "refused" && item.refusal !== undefined ? (
                <RefusalState refusal={item.refusal} evidence={{ href: `#${acceptsId}`, label: strings.dropzone_evidence_formats }} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * The attribute that asks the browser for a directory. It is not in React's typed attribute set, so
 * it is spelled once, here, as the attributes a folder door carries (I-71).
 */
const FOLDER_DOOR = { webkitdirectory: "" } as unknown as { webkitdirectory: string };
