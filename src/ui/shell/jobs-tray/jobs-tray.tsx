"use client";
/**
 * R-UI-030's jobs tray: the top bar's occupant that says what this tab has started and how it stands
 * (docs/design/shell-top-bar.md § 1). It reads the one register the inline timeline reads, so a tray
 * and a timeline over the same jobs can never disagree.
 *
 * Provider-gated, not route-gated (I-116): outside a `JobsProvider` the register answers null and the
 * tray renders nothing at all, which is what keeps every bare mount of the bar standing.
 *
 * A refused job names its cause here too, through the one RefusalState the whole tree renders a
 * refusal with (R-UI-020: one renderer serves every surface, always carrying the evidence link). A
 * row that said `Refused` and nothing else would be the silence that clause forbids — the reader
 * would have a word and no remedy, on the one surface that is reachable from every screen. It is the
 * same entry and the same evidence the inline timeline renders, from the same register: one refusal
 * read twice, never two answers (B-17). The fault id stays the timeline's: it is a thread to a
 * report, not a remedy a person can act on from the frame.
 */
import { useId } from "react";
import { Skeleton } from "../../primitives/core";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/overlay";
import { RefusalState } from "../../patterns/refusal-state";
import { kindWord, statusWord, useJobs, type TrackedJobReading } from "../../patterns/job-timeline";
import { strings } from "../../strings";

export function JobsTray() {
  const countId = useId();
  const register = useJobs();
  if (register === null) return null;
  const { jobs, state } = register;

  return (
    <Popover modal={false}>
      {/* The accessible name is the registered label alone: the numeral is not part of it, because a
          name that is not the visible text is the serious `label-content-name-mismatch` axe grades
          (I-117). The count is not sighted-only for that — it is the trigger's description, read
          from the very element the eye reads, so both readers are told the same number from one
          home (R-UI-012). The words themselves reach a reader when the panel opens. */}
      <PopoverTrigger
        className="cx-jobs-tray-trigger"
        data-testid="shell-jobs-tray"
        aria-haspopup="dialog"
        aria-label={strings.jobs_tray_label}
        aria-describedby={countId}
        data-count={String(jobs.length)}
        data-state={state}
      >
        <span className="cx-jobs-tray-dot" aria-hidden="true" />
        <span className="cx-jobs-tray-count" id={countId} aria-hidden="true">
          {jobs.length}
        </span>
      </PopoverTrigger>
      {/* Named by its own heading on screen and left without `role="dialog"`: the modal treatment
          marks the rest of the frame `aria-hidden` while its links stay focusable, the serious
          `aria-hidden-focus` finding the bar's menus already refuse (I-118). */}
      <PopoverContent align="end">
        <div className="cx-jobs-tray-body" data-testid="shell-jobs-tray-panel">
          <h2 className="cx-jobs-tray-heading">{strings.jobs_tray_heading}</h2>
          {jobs.length === 0 ? (
            <p className="cx-jobs-tray-empty" data-testid="shell-jobs-tray-empty">
              {strings.jobs_tray_empty}
            </p>
          ) : (
            <ol className="cx-jobs-tray-list">
              {jobs.map((job) => (
                <TrayItem key={job.id} job={job} />
              ))}
            </ol>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TrayItem({ job }: { job: TrackedJobReading }) {
  return (
    <li
      className="cx-jobs-tray-item"
      data-testid="shell-jobs-tray-item"
      // A job with no id carries no attribute: a machine hook never spells an empty identity (I-112).
      data-job={job.jobId ?? undefined}
      data-kind={job.kind}
      data-status={job.status}
    >
      <span className="cx-jobs-tray-dot" aria-hidden="true" />
      <span className="cx-jobs-tray-item-kind">{kindWord(job.kind)}</span>
      <span className="cx-jobs-tray-item-line">
        <span className="cx-jobs-tray-item-status">{statusWord(job.status)}</span>
        {/* The elapsed cell stands in every state, holding the bone while no number exists rather
            than standing in its place: it is the cell a baseline masks, and a mask that matches
            nothing bakes real elapsed time into the picture instead of failing. */}
        <span className="cx-jobs-tray-item-timing">
          {job.status === "running" && job.timing === null ? <Skeleton className="cx-jobs-tray-item-bone" /> : job.timing}
        </span>
      </span>
      {/* Exactly one, and only when the register resolved a registered entry for this job. */}
      {job.refusal === null ? null : (
        <div className="cx-jobs-tray-item-cause">
          <RefusalState refusal={job.refusal} evidence={job.evidence} />
        </div>
      )}
    </li>
  );
}
