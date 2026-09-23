"use client";
/**
 * The act log explorer (R-SPINE-081): the project's acts newest first, each showing what it did and
 * what it cited, over three conjunctive filters.
 *
 * The log is a 28 px grid (I-38, amending I-36): a DataTable v2 whose rows keep the contract's ids
 * and data attributes. Its act type is read in words through EnumLabel — the raw value stays on
 * `data-act-type` and in the primitive's technical disclosure (I-38 as amended for R-UI-083) — its
 * actor by the roster's label, and its identifiers through the IdChip: the consequence digest whole
 * as the chip's value, and every cited subject by what its key names, at most three and a `+k`
 * (`SubjectChips`, shared with S-Project). Filtering is in-component over the given rows; the rows
 * themselves are never re-ordered.
 */
import { useMemo, useRef, useState } from "react";

import { dhakaDateParts, formatDate, formatUserFigure } from "@/core/format";
import type { AuditAct } from "@/modules/spine/audit";
import { NO_SUBJECT_NAMES, isSurrogate, type SubjectNames } from "@/modules/spine/audit/subjects";
import { Button, EnumLabel, IdChip, Input, Select, type SelectOption } from "@/ui/primitives/core";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { shortForm } from "@/ui/primitives/core/id-chip";
import { DataTable, type DataTableColumnDef } from "@/ui/primitives/data";
import { useShellPage } from "@/ui/shell";
import { fill } from "@/ui/strings";
import { auditStrings } from "./strings";
import { ACTOR_COLUMN_WIDTH, SubjectChips, subjectAnswers } from "./subject-chips";
import { TESTIDS } from "@/ui/testids";

const ANY = "";

/** The identity the grid's column furniture is remembered under (DataTable's `tableId`). */
const ACTS_TABLE_ID = "audit-acts";

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
 * The actor as the filter's option names them: the roster's label, or — where the log could name
 * them only by the account id it recorded — the id's short form, the same measure the row's IdChip
 * shows (R-UI-082: never a whole uuid as a word).
 */
function actorWords(actorLabel: string): string {
  return isSurrogate(actorLabel) ? shortForm(actorLabel) : actorLabel;
}

/** The log's columns, over the names the cited subjects are known by. */
function columnsOf(names: SubjectNames): DataTableColumnDef<AuditAct>[] {
  return [
    {
      id: "type",
      header: auditStrings.audit_col_type,
      size: 220,
      // R-UI-083: a closed enum is read in words, and the stored value is kept, not deleted — on
      // the row's `data-act-type` and in the primitive's technical disclosure (I-38).
      cell: ({ row }) => <EnumLabel className="cx-audit-act-type" value={row.original.actType} />,
    },
    {
      id: "actor",
      header: auditStrings.audit_col_actor,
      // I-428: 280, the width S-Project's Who column gives the same person (s-project I-147 as
      // amended) — at 220 every address was cut at "@cubit.…" beside an unused band, so one person read
      // two ways on two adjacent screens (B-17).
      size: ACTOR_COLUMN_WIDTH,
      cell: ({ row }) =>
        isSurrogate(row.original.actorLabel) ? <IdChip value={row.original.actorLabel} /> : <span className="cx-audit-act-actor">{row.original.actorLabel}</span>,
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
      // I-428: 400 is the column's FLOOR — it takes the band the four before it leave (audit.css). The
      // floors sum to 220 + 280 + 120 + 140 + 400 = 1,160, which leaves a classic scrollbar (17 px, a
      // headed Chromium on Windows; 15 on Linux) inside 1280's 1,184 px band. At 420 they summed to
      // 1,180, and a window with a scrollbar on shell-main scrolled the log sideways and cut the `+k`.
      size: 400,
      cell: ({ row }) => <SubjectChips data-testid={TESTIDS.audit.actEvidence} names={names} subjects={row.original.subjects} />,
    },
  ];
}

export function ActLogExplorer({ acts, names = NO_SUBJECT_NAMES }: { acts: readonly AuditAct[]; names?: SubjectNames }) {
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
  // values themselves — each act type labelled in the words its row's EnumLabel reads (I-38), each
  // actor by the roster's label; the VALUE is the stored one either way, so the choice is exact.
  const typeOptions = useMemo<SelectOption[]>(
    () => [{ value: ANY, label: auditStrings.audit_filter_any_type }, ...actTypes.map((type) => ({ value: type, label: humaniseEnum(type) }))],
    [actTypes],
  );
  const actorOptions = useMemo<SelectOption[]>(
    () => [{ value: ANY, label: auditStrings.audit_filter_any_actor }, ...actors.map((actor) => ({ value: actor.actorId, label: actorWords(actor.actorLabel) }))],
    [actors],
  );
  const columns = useMemo(() => columnsOf(names), [names]);

  // A pasted key is compared whole, and a typed name matches a subject's presented name or one whole
  // fact of it (I-32 as amended); a blank entry is no filter.
  const cited = subject.trim();
  const shown = acts.filter(
    (given) =>
      (actType === ANY || given.actType === actType) &&
      (actorId === ANY || given.actorId === actorId) &&
      (cited === "" || given.subjects.some((each) => subjectAnswers(each, names, cited))),
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
              rules is unchanged: the all-option first, then exactly the act types the rows hold,
              each in words and in the UI face, like the row it filters (I-38). */}
          <Select
            className="cx-audit-select"
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
            columns={columns}
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
