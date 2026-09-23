"use client";
// S-Documents — every document this project has issued, newest first (R-SPINE-040,
// docs/design/s-documents.md). The screen is a READER: it issues nothing, runs no procedure and
// owns no door, so it takes its whole answer as props and draws it.
//
// Taking the answer as props is also what makes it mountable bare: nothing here asks for a router,
// a session or a seam, so the rows a suite hands it are drawn exactly as the served page's rows are
// (the acceptance's own claim, tests/ui/documents).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { EmptyState, EnumLabel, IdChip } from "@/ui/primitives/core";
// `humaniseEnum` is the one rule EnumLabel says an unlabelled value by, read from its own home
// rather than restated beside the kinds it labels (B-17, I-260).
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { DataTable } from "@/ui/primitives/data";
import { useShellPage } from "@/ui/shell";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { takeoffRoute } from "../home/areas";
import { documentsRoute } from "./route-address";
import type { DocumentsState } from "./states";

import "./documents.css";

/** The identity this grid's column furniture is remembered under (DataTable's `tableId`). */
export const DOCUMENTS_TABLE_ID = "s-documents";

/**
 * §1's column widths, the closed set of px literals this screen spends (I-348). They sum to 1,160 —
 * inside the 1,184 of the grid at 1280 with room for a scrollbar — so the row's one door stands
 * whole at both viewports; at 200 each, Issued by and Digest held a 90 px chip in 200 px of track
 * while `Open PDF` was cut to "Op". Acts cited is the remainder: its width is its floor, and it takes
 * what the grid's band leaves (documents.css).
 */
const WIDTH_KIND = 200;
const WIDTH_VERSION = 96;
const WIDTH_ISSUED_BY = 240;
const WIDTH_DIGEST = 128;
const WIDTH_ACTS = 216;
const WIDTH_SUPERSEDED = 160;
const WIDTH_DOCUMENT = 120;

/** I-262: a cell never wraps, so the acts are chipped to this many and the rest are counted. */
const ACTS_SHOWN = 2;

/** One issued document, as this screen is handed it: the listing, plus the link minted for its row. */
export interface DocumentsRowView {
  readonly id: string;
  readonly kind: string;
  readonly version: number;
  readonly sha256: string;
  readonly issuedBy: string;
  readonly actIds: readonly string[];
  readonly supersededBy: string | null;
  /** The signed address this row's document is served at, minted per render (I-264). */
  readonly href: string;
}

export interface DocumentsScreenProps {
  /** The project's issues in the store's own order, or null where the read answered nothing. */
  readonly rows: readonly DocumentsRowView[] | null;
  readonly tenantId: string;
  readonly projectId: string;
  /** The fault the read left behind, quoted beside the retry where there was one (B-21). */
  readonly reportId: string | null;
  /**
   * Account id → the label the project's roster names the person by (I-348), as the page read it
   * through the roster's own guarded door. A person it does not name — a reader it refused, an
   * account with no address, someone who has left — is shown by the id the store recorded.
   */
  readonly people?: Readonly<Record<string, string>>;
}

/** Nobody named: every issuer is shown by the id the store recorded. One object, so the columns' memo holds. */
const NO_PEOPLE: Readonly<Record<string, string>> = Object.freeze({});

/**
 * The words a kind is read by (I-260): the string table's own line for it where this screen has
 * authored one, and the enum's mechanical reading otherwise — so a kind registered by a later
 * increment reads as words on the day it is registered rather than as a key.
 */
function kindLabel(kind: string): string {
  // A kind spells itself with hyphens (`boq-draft`) and a string key with underscores, so the key is
  // derived rather than transcribed: a table that had to spell `documents_kind_boq-draft` would be
  // spelling something no other key in the seam looks like (R-SPINE-060, I-260).
  const authored = (strings as Readonly<Record<string, string>>)[`documents_kind_${kind.replaceAll("-", "_")}`];
  return authored ?? humaniseEnum(kind);
}

/** The count readout's two forms (§1's header track): a list of one says so in words. */
function countReadout(rows: number): string {
  return rows === 1 ? strings.documents_count_one : fill(strings.documents_count_other, { count: String(rows) });
}

/**
 * How many rows the grid DREW, read from the one place that knows it (B-17, the levels precedent).
 * The shipped table windows its rows once the list is long enough and publishes the number it in
 * fact put in the document; this screen's region carries the id a retrying read waits on, so it
 * repeats the table's own number rather than restating the length of the data it handed over.
 */
function useRowsDrawn(region: RefObject<HTMLElement | null>, rows: number): number {
  const [drawn, setDrawn] = useState(rows);
  useEffect(() => {
    const host = region.current;
    if (host === null) return;
    const read = (): void => {
      const said = host.querySelector("[data-rows-rendered]")?.getAttribute("data-rows-rendered");
      const count = said === null || said === undefined ? Number.NaN : Number(said);
      setDrawn(Number.isFinite(count) ? count : rows);
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(host, { attributes: true, attributeFilter: ["data-rows-rendered"], subtree: true, childList: true });
    return () => watch.disconnect();
  }, [region, rows]);
  return drawn;
}

/** What every row publishes of its own (§7's closed contract), from the listing verbatim. */
function rowDataOf(row: DocumentsRowView): Readonly<Record<string, string>> {
  return {
    "data-document": row.id,
    "data-kind": row.kind,
    "data-version": String(row.version),
    "data-superseded": String(row.supersededBy !== null),
  };
}

/** I-262's Acts-cited cell: the first act ids as chips, then how many more the act log holds. */
function ActsCited({ actIds }: { actIds: readonly string[] }): ReactNode {
  if (actIds.length === 0) return <span className="cx-documents-absent">{strings.documents_no_acts}</span>;
  const shown = actIds.slice(0, ACTS_SHOWN);
  return (
    <span className="cx-documents-acts">
      {shown.map((actId) => (
        <IdChip key={actId} value={actId} data-testid={TESTIDS.documents.act} />
      ))}
      {actIds.length > shown.length ? (
        <span className="cx-documents-acts-more">{fill(strings.documents_acts_more, { count: String(actIds.length - shown.length) })}</span>
      ) : null}
    </span>
  );
}

/**
 * I-348's Issued-by cell: the person, by the label the project's roster names them by, with the id
 * the store recorded kept whole on `data-value` — or, where the roster names nobody for it, that id
 * through the one chip (R-UI-082). A person is a name on this screen as on S-Audit and S-Project.
 */
function IssuedBy({ issuedBy, people }: { issuedBy: string; people: Readonly<Record<string, string>> }): ReactNode {
  const label = people[issuedBy];
  if (label === undefined) return <IdChip value={issuedBy} data-testid={TESTIDS.documents.issuedBy} />;
  return (
    <span className="cx-documents-person" data-testid={TESTIDS.documents.issuedBy} data-value={issuedBy}>
      {label}
    </span>
  );
}

/**
 * §1's seven columns, left to right, over the names the roster knows the issuers by. Declared beside
 * the screen so the loading leg draws the same (`DOCUMENTS_COLUMNS`, which names nobody).
 */
export function documentsColumns(people: Readonly<Record<string, string>>): ColumnDef<DocumentsRowView, unknown>[] {
  return DOCUMENT_COLUMN_ROSTER.map((column) =>
    column.id === ISSUED_BY_COLUMN ? { ...column, cell: ({ row }) => <IssuedBy issuedBy={row.original.issuedBy} people={people} /> } : column,
  );
}

/** The Issued-by column's id, which is the one column whose cell reads the roster. */
const ISSUED_BY_COLUMN = "issuedBy";

const DOCUMENT_COLUMN_ROSTER: ColumnDef<DocumentsRowView, unknown>[] = [
  {
    id: "kind",
    header: strings.documents_col_kind,
    accessorFn: (row) => row.kind,
    size: WIDTH_KIND,
    // R-UI-082: the key is model data and stays in the primitive's technical disclosure; what the
    // screen says out loud is the word the kind is authored under (I-260).
    cell: ({ row }) => <EnumLabel value={row.original.kind} label={kindLabel(row.original.kind)} className="cx-documents-kind" />,
  },
  {
    id: "version",
    header: strings.documents_col_version,
    meta: { align: "right" },
    accessorFn: (row) => String(row.version),
    size: WIDTH_VERSION,
    cell: ({ row }) => <span className="cx-documents-version">{row.original.version}</span>,
  },
  {
    id: ISSUED_BY_COLUMN,
    header: strings.documents_col_issued_by,
    accessorFn: (row) => row.issuedBy,
    size: WIDTH_ISSUED_BY,
    cell: ({ row }) => <IssuedBy issuedBy={row.original.issuedBy} people={NO_PEOPLE} />,
  },
  {
    id: "digest",
    header: strings.documents_col_digest,
    accessorFn: (row) => row.sha256,
    size: WIDTH_DIGEST,
    cell: ({ row }) => <IdChip value={row.original.sha256} data-testid={TESTIDS.documents.digest} />,
  },
  {
    id: "acts",
    header: strings.documents_col_acts,
    accessorFn: (row) => row.actIds.join(" "),
    size: WIDTH_ACTS,
    cell: ({ row }) => <ActsCited actIds={row.original.actIds} />,
  },
  {
    id: "supersededBy",
    header: strings.documents_col_superseded,
    accessorFn: (row) => row.supersededBy ?? "",
    size: WIDTH_SUPERSEDED,
    // I-261: an issue nobody has replaced says so in a word. An empty cell would leave a reader to
    // infer the live issue from a hole (R-UI-020: silence never happens).
    cell: ({ row }) =>
      row.original.supersededBy === null ? (
        <span className="cx-documents-current">{strings.documents_current}</span>
      ) : (
        <IdChip value={row.original.supersededBy} data-testid={TESTIDS.documents.supersededBy} />
      ),
  },
  {
    id: "document",
    header: strings.documents_col_document,
    size: WIDTH_DOCUMENT,
    // A CONTROL WELL: the cell holds one anchor and nothing else, so the anchor IS the cell — it
    // fills it rather than floating inside it, which is what makes the row's door a target of the
    // cell's own size (WCAG 2.2 SC 2.5.8, the primitive's `meta.control`). A well carries no text to
    // widen, so it is not resized either, and its edge never crowds the header's column chooser.
    meta: { control: true },
    // I-258: the door serves an attachment, so this is a plain anchor at a minted address and never
    // a client navigation into a viewer this screen does not have.
    cell: ({ row }) => (
      <a
        className="cx-btn cx-reticle cx-documents-open"
        data-variant="ghost"
        data-testid={TESTIDS.documents.open}
        href={row.original.href}
        aria-label={fill(strings.documents_open_label, { kind: kindLabel(row.original.kind), version: String(row.original.version) })}
      >
        {strings.documents_open}
      </a>
    ),
  },
];

/** The seven columns naming nobody — the loading leg's, which has no roster and no rows to name. */
export const DOCUMENTS_COLUMNS: ColumnDef<DocumentsRowView, unknown>[] = DOCUMENT_COLUMN_ROSTER;

export function DocumentsScreen({ rows, tenantId, projectId, reportId, people = NO_PEOPLE }: DocumentsScreenProps): ReactNode {
  // R-UI-084: the page a reader is on reaches the frame's crumb slot from the screen that is it.
  useShellPage(strings.documents_title);

  const gridRegion = useRef<HTMLDivElement | null>(null);
  const listed = useMemo(() => (rows === null ? [] : [...rows]), [rows]);
  const rowsDrawn = useRowsDrawn(gridRegion, listed.length);
  // Stable per roster: a table handed new column objects on every render re-reads its remembered
  // furniture from scratch (DataTable §5 rule 3).
  const columns = useMemo(() => (people === NO_PEOPLE ? DOCUMENTS_COLUMNS : documentsColumns(people)), [people]);

  // §2's order, first holding wins: the read that failed left a report id behind, and it is the
  // fault that decides the state — the rows are null in that case because there are none to draw,
  // never the other way round. `loading` is loading.tsx's, which holds the route before this mounts.
  const state: DocumentsState = reportId !== null ? "error" : listed.length === 0 ? "empty" : "ready";

  return (
    // I-348: the root states itself — `data-screen-root` beside the `data-state` it always carried —
    // so `settled()` and a retrying read wait on this screen as on every other (the I-213 class).
    <div className="cx-documents" data-testid={TESTIDS.documents.screen} data-screen-root="" data-state={state}>
      <header className="cx-documents-header">
        <h1 className="cx-documents-heading">{strings.documents_title}</h1>
        {/* The count is what the list HOLDS, so it stands wherever there is a list to count — and
            it is absent where the read failed, because a zero there would be a figure nobody read. */}
        {state === "error" ? null : (
          <span className="cx-documents-count" role="status">
            {countReadout(listed.length)}
          </span>
        )}
      </header>

      {state === "error" ? (
        <div className="cx-documents-fault" data-testid={TESTIDS.documents.error} role="alert">
          <h2 className="cx-documents-fault-heading">{strings.documents_error_heading}</h2>
          <p className="cx-documents-fault-body">{strings.documents_error_body}</p>
          {reportId === null ? null : (
            <p className="cx-documents-report">
              <span className="cx-documents-report-label">{strings.documents_report_label}</span>
              <IdChip value={reportId} data-testid={TESTIDS.documents.reportId} />
            </p>
          )}
          {/* I-263: the screen runs no procedure, so the retry is this address requested again. */}
          <Link
            className="cx-btn cx-reticle"
            data-variant="secondary"
            data-testid={TESTIDS.documents.retry}
            href={documentsRoute(tenantId, projectId)}
          >
            {strings.documents_retry}
          </Link>
        </div>
      ) : state === "empty" ? (
        // A document is issued from published work, so the register is where a reader goes next.
        <EmptyState
          className="cx-documents-empty"
          data-testid={TESTIDS.documents.empty}
          heading={strings.documents_empty_heading}
          body={strings.documents_empty_body}
        >
          <Link className="cx-btn cx-reticle" data-variant="primary" href={takeoffRoute(tenantId, projectId)}>
            {strings.documents_empty_action}
          </Link>
        </EmptyState>
      ) : (
        <div
          className="cx-documents-grid"
          ref={gridRegion}
          data-testid={TESTIDS.documents.grid}
          // I-348: the region says it is the rendered contract, and the count is the table's own.
          data-rendered-region={TESTIDS.documents.grid}
          data-rows-rendered={rowsDrawn}
        >
          <DataTable
            tableId={DOCUMENTS_TABLE_ID}
            columns={columns}
            data={listed}
            getRowId={(row) => row.id}
            // R-UI-083's own default, stated as the density REGION the primitive provides for it
            // (§5 rule 1): a list of issues is a reference grid and reads at the compact 28 px row
            // whatever height the reader's other surfaces stand at.
            density="compact"
            rowTestId={TESTIDS.documents.row}
            rowDataOf={rowDataOf}
            aria-label={strings.documents_grid_label}
          />
        </div>
      )}
    </div>
  );
}
