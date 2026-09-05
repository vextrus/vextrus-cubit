"use client";
/**
 * The act log explorer (R-SPINE-081): the project's acts newest first, each showing what it did and
 * what it cited, over three conjunctive filters.
 *
 * Filtering is in-component over the rows it was given — the read already answered, and narrowing a
 * list a person is looking at is not a second question for the server. Nothing is discarded: a
 * cleared filter brings its rows straight back, because the given rows are what the component holds.
 *
 * The screen is a reader (L-ACT-01): nothing here commits an act, so the one action it carries is
 * the clearing of its own filters.
 */
import { useMemo, useRef, useState } from "react";

import { dhakaDateParts, formatDate, formatUserFigure } from "../../../../../../../core/format";
import type { AuditAct } from "../../../../../../../modules/spine/audit";
import { Button, Input } from "../../../../../../../ui/primitives/core";
import { fill } from "../../../../../../../ui/strings";
import { auditStrings } from "./strings";

/** The value a select carries when it is filtering nothing — its own first option (I-31). */
const ANY = "";

/** One actor, as the actor filter offers them: the id it filters by, under the name it shows. */
interface ActorChoice {
  readonly actorId: string;
  readonly actorLabel: string;
}

/** Code-point order: `localeCompare` is a locale's opinion, and these are identifiers (I-25). */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The date seam's date, from the act's Asia/Dhaka wall-clock parts (I-34, SEAM-FORMAT). `getDate()`
 * and its siblings read the host's zone, which on a UTC-clocked server puts an act committed before
 * six in the morning on the previous day — a wrong date on the one surface whose work is exactness.
 * Both halves of the conversion are the format seam's, so the day is the reader's day wherever the
 * process runs and this screen holds no offset of its own (B-17, L-FMT-01).
 */
function occurred(at: Date): string {
  return formatDate(dhakaDateParts(at));
}

export function ActLogExplorer({ acts }: { acts: readonly AuditAct[] }) {
  // Where focus goes when the control holding it clears the filters: that button stands inside the
  // filtered-empty block, which the clearing unmounts, and focus dropped to <body> puts a keyboard
  // reader back at the top of the document (R-UI-012). The first filter is the field the cleared
  // list is now answering, so it is where the work continues.
  const firstFilter = useRef<HTMLSelectElement>(null);
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
          <select
            // Mono is I-25's treatment of a model value, and only a chosen act type is one: the
            // all-option is this control's own chrome and reads in the face the row's other
            // control reads in.
            className={`cx-input cx-reticle cx-audit-select${actType === ANY ? "" : " cx-audit-select-mono"}`}
            data-testid="audit-filter-type"
            id="audit-filter-type-field"
            onChange={(event) => setActType(event.target.value)}
            ref={firstFilter}
            value={actType}
          >
            <option value={ANY}>{auditStrings.audit_filter_any_type}</option>
            {actTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="cx-audit-filter">
          <label className="cx-audit-filter-label" htmlFor="audit-filter-actor-field">
            {auditStrings.audit_filter_actor_label}
          </label>
          <select
            className="cx-input cx-reticle cx-audit-select"
            data-testid="audit-filter-actor"
            id="audit-filter-actor-field"
            onChange={(event) => setActorId(event.target.value)}
            value={actorId}
          >
            <option value={ANY}>{auditStrings.audit_filter_any_actor}</option>
            {actors.map((actor) => (
              <option key={actor.actorId} value={actor.actorId}>
                {actor.actorLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="cx-audit-filter">
          <label className="cx-audit-filter-label" htmlFor="audit-filter-subject-field">
            {auditStrings.audit_filter_subject_label}
          </label>
          <Input
            className="cx-audit-subject"
            data-testid="audit-filter-subject"
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
        <div className="cx-audit-empty" data-testid="audit-acts-empty">
          <p className="cx-audit-empty-heading">{acts.length === 0 ? auditStrings.audit_empty_none_heading : auditStrings.audit_empty_filtered_heading}</p>
          <p className="cx-audit-empty-body">{acts.length === 0 ? auditStrings.audit_empty_none_body : auditStrings.audit_empty_filtered_body}</p>
          {acts.length === 0 ? null : (
            <Button className="cx-audit-empty-clear" onClick={clearFilters} variant="ghost">
              {auditStrings.audit_empty_clear}
            </Button>
          )}
        </div>
      ) : (
        <ol className="cx-audit-acts" data-testid="audit-acts">
          {shown.map((given) => (
            <li className="cx-audit-act" data-act-type={given.actType} data-actor-id={given.actorId} data-testid="audit-act-row" key={given.actId}>
              <div className="cx-audit-act-meta">
                <span className="cx-audit-act-type">{given.actType}</span>
                <span className="cx-audit-act-actor">{given.actorLabel}</span>
                <span className="cx-audit-act-when">{occurred(given.occurredAt)}</span>
              </div>
              <div className="cx-audit-act-line">
                <span className="cx-audit-act-label">{auditStrings.audit_consequence_label}</span>
                <span className="cx-audit-act-value" data-testid="audit-act-consequence">
                  {given.consequenceDigest}
                </span>
              </div>
              <div className="cx-audit-act-line">
                <span className="cx-audit-act-label">{auditStrings.audit_evidence_label}</span>
                <span className="cx-audit-act-evidence" data-testid="audit-act-evidence">
                  {given.subjects.map((each) => (
                    <span className="cx-audit-act-value" key={each}>
                      {each}
                    </span>
                  ))}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
