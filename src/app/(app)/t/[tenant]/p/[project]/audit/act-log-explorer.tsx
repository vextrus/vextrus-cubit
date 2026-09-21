"use client";
/**
 * The act log explorer (R-SPINE-081): the project's acts newest first, each showing what it did and
 * what it cited, over three conjunctive filters.
 *
 * The log is a 28 px grid (I-38, amending I-36): a DataTable v2 whose rows keep the contract's ids
 * and data attributes, whose identifiers — the consequence digest and every cited subject — render
 * through the IdChip (I-38, amending I-26), and whose act type stands verbatim in mono because it is
 * the model's own word (I-25). Filtering is in-component over the given rows; the rows themselves
 * are never re-ordered.
 */
import { useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { dhakaDateParts, formatDate, formatUserFigure } from "@/core/format";
import type { AuditAct } from "@/modules/spine/audit";
import { Button, IdChip, Input, Select, type SelectOption } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { useShellPage } from "@/ui/shell";
import { fill } from "@/ui/strings";
import { auditStrings } from "./strings";
import { TESTIDS } from "@/ui/testids";

const ANY = "";

/** The identity the grid's column furniture is remembered under (DataTable's `tableId`). */
const ACTS_TABLE_ID = "audit-acts";

/** The shape of an account id: an actor the log can name only so is rendered as the identifier it is. */
const IDENTIFIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ActorChoice {
  readonly actorId: string;
  readonly actorLabel: string;
}

function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function occurred(at: Date): string {
  return formatDate(dhakaDateParts(at));
}

/**
 * The measure a subject shows on its chip: a `scheme:key` source key shows its key, because the
 * scheme is the same on every subject of a row and the key is what a reader recognises; anything
 * else takes the chip's own leading characters. The whole subject is the chip's value either way.
 */
function subjectMeasure(subject: string): string | undefined {
  const colon = subject.indexOf(":");
  return colon > 0 && colon < subject.length - 1 ? subject.slice(colon + 1) : undefined;
}

const COLUMNS: ColumnDef<AuditAct, unknown>[] = [
  { id: "type", header: auditStrings.audit_col_type, size: 220, cell: ({ row }) => <span className="cx-audit-act-type">{row.original.actType}</span> },
  {
    id: "actor",
    header: auditStrings.audit_col_actor,
    size: 160,
    cell: ({ row }) => (IDENTIFIER.test(row.original.actorLabel) ? <IdChip value={row.original.actorLabel} /> : <span className="cx-audit-act-actor">{row.original.actorLabel}</span>),
  },
  { id: "occurred", header: auditStrings.audit_col_occurred, size: 120, cell: ({ row }) => <span className="cx-audit-act-when">{occurred(row.original.occurredAt)}</span> },
  {
    id: "consequence",
    header: auditStrings.audit_consequence_label,
    size: 140,
    cell: ({ row }) => <IdChip data-testid={TESTIDS.audit.actConsequence} value={row.original.consequenceDigest} />,
  },
  {
    id: "evidence",
    header: auditStrings.audit_evidence_label,
    size: 360,
    cell: ({ row }) => (
      <span className="cx-audit-act-evidence" data-testid={TESTIDS.audit.actEvidence}>
        {row.original.subjects.map((each) => (
          <IdChip key={each} short={subjectMeasure(each)} value={each} />
        ))}
      </span>
    ),
  },
];

export function ActLogExplorer({ acts }: { acts: readonly AuditAct[] }) {
  // R-UI-084: the trail's last crumb is this screen's own word, under the project's home.
  useShellPage(auditStrings.audit_heading);
  // Where focus goes when the control holding it clears the filters: that button stands inside the
  // filtered-empty block, which the clearing unmounts, and focus dropped to <body> puts a keyboard
  // reader back at the top of the document (R-UI-012). The first filter is the field the cleared
  // list is now answering, so it is where the work continues.
  const firstFilter = useRef<HTMLButtonElement>(null);
  const [actType, setActType] = useState<string>(ANY);
  const [actorId, setActorId] = useState<string>(ANY);
  const [subject, setSubject] = useState<string>("");

  // The choices are the values the given rows actually hold: a filter over anything else would offer
  // a choice that can only produce emptiness (I-31).
  const actTypes = useMemo<readonly string[]>(() => [...new Set(acts.map((given) => given.actType))].sort(byCodePoint), [acts]);
  const actors = useMemo<readonly ActorChoice[]>(() => {
    const named = new Map<string, string>();
    for (const given of acts) if (!named.has(given.actorId)) named.set(given.actorId, given.actorLabel);
    return [...named].map(([id, label]) => ({ actorId: id, actorLabel: label })).sort((left, right) => byCodePoint(left.actorLabel, right.actorLabel));
  }, [acts]);

  // What each filter offers, in the shape the Select takes: the all-option first (I-31), then the
  // values themselves — an act type is shown verbatim because it IS the model's word (I-25).
  const typeOptions = useMemo<SelectOption[]>(
    () => [{ value: ANY, label: auditStrings.audit_filter_any_type }, ...actTypes.map((type) => ({ value: type, label: type }))],
    [actTypes],
  );
  const actorOptions = useMemo<SelectOption[]>(
    () => [{ value: ANY, label: auditStrings.audit_filter_any_actor }, ...actors.map((actor) => ({ value: actor.actorId, label: actor.actorLabel }))],
    [actors],
  );

  // A subject is an identifier, so it is compared whole; a blank entry is no filter (I-32).
  const cited = subject.trim();
  const shown = acts.filter(
    (given) => (actType === ANY || given.actType === actType) && (actorId === ANY || given.actorId === actorId) && (cited === "" || given.subjects.includes(cited)),
  );

  const clearFilters = (): void => {
    setActType(ANY);
    setActorId(ANY);
    setSubject("");
    firstFilter.current?.focus();
  };

  return (
    <section className="cx-audit-section" aria-labelledby="audit-acts-heading">
      <h2 className="cx-audit-section-heading" id="audit-acts-heading">
        {auditStrings.audit_acts_heading}
      </h2>

      <div className="cx-audit-filters">
        <div className="cx-audit-filter">
          <label className="cx-audit-filter-label" htmlFor="audit-filter-type-field">
            {auditStrings.audit_filter_type_label}
          </label>
          {/* The shipped Select (Design Direction 00 §1 refuses the native control — the
              platform's popup cannot be drawn at this instrument's weight). The closed choice I-31
              rules is unchanged: the all-option first, then exactly the act types the rows hold.
              Mono is I-25's treatment of a model value, and only a chosen act type is one: the
              all-option is this control's own chrome and reads in the face the row's other control
              reads in. */}
          <Select
            className={actType === ANY ? "cx-audit-select" : "cx-audit-select cx-audit-select-mono"}
            data-testid={TESTIDS.audit.filterType}
            id="audit-filter-type-field"
            onChange={setActType}
            options={typeOptions}
            ref={firstFilter}
            value={actType}
          />
        </div>

        <div className="cx-audit-filter">
          <label className="cx-audit-filter-label" htmlFor="audit-filter-actor-field">
            {auditStrings.audit_filter_actor_label}
          </label>
          <Select
            className="cx-audit-select"
            data-testid={TESTIDS.audit.filterActor}
            id="audit-filter-actor-field"
            onChange={setActorId}
            options={actorOptions}
            value={actorId}
          />
        </div>

        <div className="cx-audit-filter">
          <label className="cx-audit-filter-label" htmlFor="audit-filter-subject-field">
            {auditStrings.audit_filter_subject_label}
          </label>
          <Input
            className="cx-audit-subject"
            data-testid={TESTIDS.audit.filterSubject}
            id="audit-filter-subject-field"
            onChange={(event) => setSubject(event.target.value)}
            value={subject}
          />
        </div>

        <p className="cx-audit-count" role="status">
          {fill(auditStrings.audit_count, { shown: formatUserFigure(String(shown.length)), total: formatUserFigure(String(acts.length)) })}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="cx-audit-empty" data-testid={TESTIDS.audit.actsEmpty}>
          <p className="cx-audit-empty-heading">{acts.length === 0 ? auditStrings.audit_empty_none_heading : auditStrings.audit_empty_filtered_heading}</p>
          <p className="cx-audit-empty-body">{acts.length === 0 ? auditStrings.audit_empty_none_body : auditStrings.audit_empty_filtered_body}</p>
          {acts.length === 0 ? null : (
            <Button className="cx-audit-empty-clear" onClick={clearFilters} variant="ghost">
              {auditStrings.audit_empty_clear}
            </Button>
          )}
        </div>
      ) : (
        <div className="cx-audit-acts" data-testid={TESTIDS.audit.acts} data-rows={shown.length}>
          <DataTable
            tableId={ACTS_TABLE_ID}
            aria-labelledby="audit-acts-heading"
            columns={COLUMNS}
            data={shown}
            getRowId={(act) => act.actId}
            rowTestId={TESTIDS.audit.actRow}
            rowDataOf={(act) => ({ "data-act-type": act.actType, "data-actor-id": act.actorId })}
          />
        </div>
      )}
    </section>
  );
}
