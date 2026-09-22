"use client";
// S-Drawings-Sets (R-TO-005): the sets index — the door that names a set, and one row per set the
// project holds with the digest it stands pinned at.
//
// I-285: the sets are a GRID. The list they used to be was no work surface a reader could read as
// one — no sticky header, no frozen key column, no compact row — and no candidate the craft rubric
// measures, so the screen scored the primary region it did not have. The rows now stand in the one
// shipped DataTable, at the compact 28 px row every other reference surface of this product reads
// at, and the header and create tracks are single rows so the grid starts within 240 px of the top
// of `shell-main` (AM-08 Part 2, CLAUDE.md's grid law).
//
// `createSet` replaces the server action and nothing else: given it, the screen maps the settlement
// exactly as it maps the real one, which is what makes the screen a browser renders and the section
// a test renders one component (the SheetIndex precedent).
import { useCallback, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, IdChip, Input } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { ShellEmptyState, useShellPage } from "@/ui/shell";
import { strings } from "@/ui/strings";
import type { DrawingSetSummary } from "@/modules/takeoff/sets";
import { participantsRoute } from "../../settings/participants/route-address";
import { drawingsRoute } from "../route-address";
import { createSet as createSetAction } from "./actions";
import { setRoute, setsRoute } from "./route-address";
import { useRowsDrawn } from "./rows-drawn";
import { sets } from "./strings";
import { TESTIDS } from "@/ui/testids";

/** The identity this grid's column furniture is remembered under (DataTable's `tableId`). */
export const SETS_TABLE_ID = "s-drawings-sets";

/** §1's column widths, this screen's own closed set of px literals (§5). */
const WIDTH_NAME = 320;
const WIDTH_MEMBERS = 120;
const WIDTH_REVISIONS = 160;
const WIDTH_DIGEST = 220;
const WIDTH_OPEN = 140;

export interface SetsIndexProps {
  tenantId: string;
  projectId: string;
  sets: readonly DrawingSetSummary[];
  /** Whether this reader holds PIN_SET on the project (I-101). */
  canPin: boolean;
  createSet?: typeof createSetAction;
}

/** Where a refusal this screen can meet is resolved: a place, named in the button voice. */
interface Evidence {
  readonly href: string;
  readonly label: string;
}

/** What every row publishes of its own (§7's closed contract), from the summary verbatim. */
function rowDataOf(set: DrawingSetSummary): Readonly<Record<string, string>> {
  return { "data-set": set.setId, "data-name": set.name };
}

/**
 * §1's five columns, left to right. The name is the frozen key column; the two counts are tabular
 * figures through the one document formatter; the digest keeps the element the contract names, with
 * its `data-digest` and its chip inside it (I-99, I-107); the door is a control well, so the cell
 * and the link a reader aims at are one target (WCAG 2.2 SC 2.5.8, the S-Documents precedent).
 */
function setsColumns(tenantId: string, projectId: string): ColumnDef<DrawingSetSummary, unknown>[] {
  return [
    {
      id: "name",
      header: sets.sets_col_name,
      accessorFn: (row) => row.name,
      size: WIDTH_NAME,
      cell: ({ row }) => (
        <span className="cx-sets-row-name" data-testid={TESTIDS.set.rowName}>
          {row.original.name}
        </span>
      ),
    },
    {
      id: "members",
      header: sets.sets_col_members,
      meta: { align: "right" },
      accessorFn: (row) => String(row.memberCount),
      size: WIDTH_MEMBERS,
      cell: ({ row }) => formatUserFigure(String(row.original.memberCount)),
    },
    {
      id: "revisions",
      header: sets.sets_col_revisions,
      meta: { align: "right" },
      accessorFn: (row) => String(row.revisionCount),
      size: WIDTH_REVISIONS,
      cell: ({ row }) => formatUserFigure(String(row.original.revisionCount)),
    },
    {
      id: "digest",
      header: sets.sets_col_digest,
      accessorFn: (row) => row.currentDigest ?? "",
      size: WIDTH_DIGEST,
      // I-99: a set that has never been pinned publishes no digest and says so in prose — never a
      // dash, and never a fake hex value. The label the line used to carry is the column's header.
      cell: ({ row }) =>
        row.original.currentDigest === null ? (
          <span className="cx-sets-row-unpinned" data-testid={TESTIDS.set.rowDigest} data-digest="">
            {sets.sets_row_digest_none}
          </span>
        ) : (
          <span className="cx-sets-row-digest" data-testid={TESTIDS.set.rowDigest} data-digest={row.original.currentDigest}>
            <IdChip className="cx-sets-digest" value={row.original.currentDigest} />
          </span>
        ),
    },
    {
      id: "open",
      header: sets.sets_col_open,
      size: WIDTH_OPEN,
      meta: { control: true },
      cell: ({ row }) => (
        <Link className="cx-sets-link cx-sets-open cx-reticle" data-testid={TESTIDS.set.open} href={setRoute(tenantId, projectId, row.original.setId)}>
          {sets.sets_open}
        </Link>
      ),
    },
  ];
}

export function SetsIndex({ tenantId, projectId, sets: held, canPin, createSet = createSetAction }: SetsIndexProps) {
  // R-UI-084: the trail's last crumb is this screen's own word, under the project's Drawings area.
  useShellPage(sets.sets_heading);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const gridRegion = useRef<HTMLDivElement | null>(null);
  const headingIds = { create: useId(), list: useId() };
  const nameId = useId();

  const rows = useMemo(() => [...held], [held]);
  const columns = useMemo(() => setsColumns(tenantId, projectId), [tenantId, projectId]);
  const rowsDrawn = useRowsDrawn(gridRegion, rows.length);

  const evidenceFor = useCallback(
    (code: RefusalCode): Evidence => {
      if (code === "PERMISSION_NOT_HELD" || code === "WORKSPACE_PERMISSION_NOT_HELD") return { href: participantsRoute(tenantId, projectId), label: sets.sets_evidence_participants };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return { href: setsRoute(tenantId, projectId), label: sets.sets_evidence_reload };
    },
    [tenantId, projectId],
  );

  const submit = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setRefusal(null);
    // The door is released whatever the write answers: a refusal is this screen's answer, and a
    // fault belongs to the boundary — neither leaves the door standing in its loading state (B-21).
    const answered = await createSet({ tenantId, projectId, name }).finally(() => setPending(false));
    if (!answered.created) {
      setRefusal(answered.refusal);
      return;
    }
    // The new set standing open is the answer — no toast, and nothing here says it twice. The set
    // is server-read at its own address, so the way to it is the address itself.
    standAt(setRoute(tenantId, projectId, answered.setId));
  };

  return (
    <div className="cx-sets" data-screen-root="" data-state={held.length === 0 ? "empty" : "ready"}>
      {/* I-285: one track, not three — the heading, what the screen is for and the way to the
          drawings stand on a single row, so the grid beneath them is the first thing a reader's eye
          lands on. */}
      <header className="cx-sets-header">
        <h1 className="cx-sets-heading">{sets.sets_heading}</h1>
        <p className="cx-sets-caption">{sets.sets_caption}</p>
        <Link className="cx-sets-link cx-reticle" data-testid={TESTIDS.set.drawingsLink} href={drawingsRoute(tenantId, projectId)}>
          {sets.sets_drawings_link}
        </Link>
      </header>

      {/* I-101: the whole index stands for a reader without PIN_SET — knowledge is not permission —
          and one banner names the permission and who holds it. A door that can only refuse is not
          rendered at all. */}
      {canPin ? null : (
        <div className="cx-sets-denied">
          <p className="cx-sets-denied-line">{sets.sets_denied_permission}</p>
          <p className="cx-sets-denied-line">{sets.sets_denied_holder}</p>
          <RefusalState refusal={refusalOf("PERMISSION_NOT_HELD")} evidence={evidenceFor("PERMISSION_NOT_HELD")} />
        </div>
      )}

      {canPin ? (
        <section className="cx-sets-section" aria-labelledby={headingIds.create}>
          <div className="cx-sets-track">
            <h2 className="cx-sets-section-heading" id={headingIds.create}>
              {sets.sets_create_heading}
            </h2>
            <p className="cx-sets-hint">{sets.sets_create_hint}</p>
          </div>
          <form
            className="cx-sets-form"
            data-testid={TESTIDS.set.createForm}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="cx-sets-field-label" htmlFor={nameId}>
              {sets.sets_name_label}
            </label>
            <Input className="cx-sets-name" data-testid={TESTIDS.set.nameInput} id={nameId} ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} />
            <Button data-testid={TESTIDS.set.create} loading={pending} type="submit">
              {sets.sets_create_submit}
            </Button>
          </form>
          <p className="cx-sets-status cx-shell-live" role="status" aria-live="polite">
            {pending ? sets.sets_create_pending : null}
          </p>
          <div className="cx-sets-answer cx-shell-live">
            {refusal === null || pending ? null : <RefusalState refusal={refusalOf(refusal)} evidence={evidenceFor(refusal)} />}
          </div>
        </section>
      ) : null}

      <section className="cx-sets-section cx-sets-listing" aria-labelledby={headingIds.list}>
        <div className="cx-sets-track">
          <h2 className="cx-sets-section-heading" id={headingIds.list}>
            {sets.sets_list_heading}
          </h2>
          <p className="cx-sets-hint">{sets.sets_list_hint}</p>
        </div>

        {held.length === 0 ? (
          <div data-testid={TESTIDS.sets.empty}>
            <ShellEmptyState heading={sets.sets_empty_heading} body={sets.sets_empty_body}>
              {canPin ? (
                <Button variant="secondary" onClick={() => nameRef.current?.focus()}>
                  {sets.sets_empty_action}
                </Button>
              ) : (
                <Link className="cx-sets-link cx-reticle" href={drawingsRoute(tenantId, projectId)}>
                  {sets.sets_drawings_link}
                </Link>
              )}
            </ShellEmptyState>
          </div>
        ) : (
          // The region a retrying read waits on keeps the id the contract names and repeats the
          // table's own drawn-row count (§7, unchanged — the id moved from a `<ul>` to the frame
          // around the grid, and no test id was added or renamed).
          <div className="cx-sets-grid" ref={gridRegion} data-testid={TESTIDS.sets.index} data-rows-rendered={rowsDrawn}>
            <DataTable
              tableId={SETS_TABLE_ID}
              aria-labelledby={headingIds.list}
              columns={columns}
              data={rows}
              getRowId={(row) => row.setId}
              // R-UI-083's own default, stated as the density REGION the primitive provides for it:
              // a list of sets is a reference grid and reads at the compact 28 px row whatever
              // height the reader's other surfaces stand at.
              density="compact"
              rowTestId={TESTIDS.set.row}
              rowDataOf={rowDataOf}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/** Stand the browser at an address of this product's own — the one navigation this screen makes. */
function standAt(href: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(href);
}
