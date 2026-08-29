/**
 * What a gallery entry is, as a type: one catalogued component and the named states it can be
 * mounted in (R-UI-011). A state's name is both its label and its `data-state` value, so the two
 * cannot drift.
 */
import type { ReactNode } from "react";

/** One named, mountable state — the sample it renders is the evidence of the component. */
export interface GalleryState {
  readonly name: string;
  readonly render: () => ReactNode;
}

/** One catalogued component: its states, in the order the gallery renders them. */
export interface GalleryEntry {
  readonly states: readonly GalleryState[];
}

/** The catalogue, keyed `"<barrelId>/<ExportName>"`. */
export type GalleryEntries = Readonly<Record<string, GalleryEntry>>;
