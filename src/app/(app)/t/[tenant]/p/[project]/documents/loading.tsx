// R-UI-050's loading leg for the documents list, and R-UI-004's rule for it: a table waits as bones
// that keep its layout, never as a spinner. The header track is real — the heading is this screen's
// whatever the read answers — and the grid stands in its `loading` posture over the same columns the
// screen draws, so the rows arrive into the shape that was already there.
"use client";

import { DataTable } from "@/ui/primitives/data";
import { strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { DOCUMENTS_COLUMNS, DOCUMENTS_TABLE_ID } from "./documents-screen";

import "./documents.css";

/** What a first screenful of this list holds while it is on its way (§2's loading cell). */
const BONES = 8;

export default function ProjectDocumentsLoading() {
  return (
    <div className="cx-documents" data-testid={TESTIDS.documents.screen} data-state="loading">
      <header className="cx-documents-header">
        <h1 className="cx-documents-heading">{strings.documents_title}</h1>
      </header>
      <div className="cx-documents-grid">
        <DataTable
          tableId={DOCUMENTS_TABLE_ID}
          columns={DOCUMENTS_COLUMNS}
          data={[]}
          getRowId={(row) => row.id}
          loading
          loadingRows={BONES}
          aria-label={strings.documents_grid_label}
        />
      </div>
    </div>
  );
}
