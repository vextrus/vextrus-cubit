// R-UI-050's matrix for the documents list, in the one enumerable place a suite reflects over
// (B-19). These four are exactly what `documents-screen[data-state]` can wear, in the order
// docs/design/s-documents.md §2 resolves them — first holding wins. The other three of the clause's
// seven are declared in `src/ui/screen-states/matrix.tsx` under this screen's file route: a reader
// cannot stand in them here, and a vocabulary that claimed otherwise would be a promise the screen
// never keeps.
export const DOCUMENTS_STATES = ["loading", "empty", "error", "ready"] as const;

/** One of them. */
export type DocumentsState = (typeof DOCUMENTS_STATES)[number];
