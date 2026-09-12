"use client";
/**
 * R-UI-024's job timeline, inline where the work was started (X-1: "the job timeline animates
 * ingestion"), and its one home for every screen that starts a long operation (B-17).
 *
 * The component is pure DOM: it reads no context and performs no request. Every string it shows
 * arrives already resolved — the timing formatted, the refusal looked up — or comes from the shared
 * table; the heading is the consumer's own copy, because a shared component may not name a screen's
 * region for it (docs/design/job-timeline.md I-107, I-113).
 */
import { useId } from "react";
import { Skeleton } from "../../primitives/core";
import { RefusalState } from "../refusal-state";
import { strings } from "../../strings";
import { kindWord, statusWord, timelineState, type TimelineStep } from "./reading";
import { TESTIDS } from "@/ui/testids";

export interface JobTimelineProps {
  /** The region's own name, in the consumer's words (I-107). */
  heading: string;
  steps: readonly TimelineStep[];
  /** Whether live progress stopped arriving for any of these jobs (I-111). */
  lost?: boolean;
  /** Whether a step the consumer knows is coming has not been asked for yet (I-109). */
  awaiting?: boolean;
}

export function JobTimeline({ heading, steps, lost = false, awaiting = false }: JobTimelineProps) {
  const headingId = useId();
  const state = timelineState(
    steps.map((step) => step.status),
    awaiting,
  );

  return (
    <section className="cx-job-timeline" data-testid={TESTIDS.job.timeline} data-state={state} aria-labelledby={headingId}>
      <h2 className="cx-job-timeline-heading" id={headingId}>
        {heading}
      </h2>
      {steps.length === 0 ? (
        <p className="cx-job-timeline-idle" data-testid={TESTIDS.job.timelineIdle}>
          {strings.job_timeline_idle}
        </p>
      ) : (
        <ol className="cx-job-timeline-steps">
          {steps.map((step) => (
            <Step key={step.id} step={step} />
          ))}
        </ol>
      )}
      {/* The last known statuses stand beside this line, never in place of them (I-111). */}
      {lost ? (
        <p className="cx-job-timeline-lost" data-testid={TESTIDS.job.timelineTransportLost} role="status">
          {strings.job_timeline_transport_lost}
        </p>
      ) : null}
    </section>
  );
}

function Step({ step }: { step: TimelineStep }) {
  return (
    <li
      className="cx-job-timeline-step"
      data-testid={TESTIDS.job.timelineStep}
      // A machine hook never spells an empty identity: a job with no id carries no attribute (I-112).
      data-job={step.jobId ?? undefined}
      data-kind={step.kind}
      data-status={step.status}
    >
      {/* The status word carries the meaning; the marker only repeats it (R-UI-060). */}
      <span className="cx-job-timeline-marker" aria-hidden="true" />
      <span className="cx-job-timeline-step-name">{kindWord(step.kind)}</span>
      <span className="cx-job-timeline-step-status" data-testid={TESTIDS.job.timelineStepStatus} aria-live="polite">
        {statusWord(step.status)}
      </span>
      {/* R-UI-004: a bone rather than a spinner, and no digits invented while none exist. */}
      {step.status === "running" && step.timing === null ? (
        <Skeleton className="cx-job-timeline-step-bone" />
      ) : (
        <span className="cx-job-timeline-step-timing" data-testid={TESTIDS.job.timelineStepTiming}>
          {step.timing ?? ""}
        </span>
      )}
      <Cause step={step} />
    </li>
  );
}

/**
 * Why a step ended as it did, and never silence (C-SPINE-JOBS: "a job never fails silently";
 * R-UI-020: "a refusal is never a toast alone … silence never happens"). A refused step whose code
 * the register holds renders the one RefusalState with the registered message, remedy and its own
 * evidence. A step that ended badly with no entry to render — a fault, or a code the taxonomy never
 * wrote — says what is known instead of standing on the status word alone: the fault id under the
 * term that says what the string is, or the sentence that no reason was recorded, and in both cases
 * the evidence link, which is the place to act. Fabricating a refusal card for either would put a
 * sentence in a person's mouth the taxonomy never wrote (I-110).
 */
function Cause({ step }: { step: TimelineStep }) {
  if (step.refusal !== null) {
    return (
      <div className="cx-job-timeline-cause">
        <RefusalState refusal={step.refusal} evidence={step.evidence} />
      </div>
    );
  }
  if (step.status !== "failed" && step.status !== "refused") return null;
  return (
    <div className="cx-job-timeline-cause">
      {step.faultId === null ? (
        <p className="cx-job-timeline-unnamed">{strings.job_timeline_cause_unnamed}</p>
      ) : (
        <p className="cx-job-timeline-fault-line">
          <span className="cx-job-timeline-fault-term">{strings.job_timeline_fault_term}</span>{" "}
          {/* The id and nothing else: it is echoed exactly as it was handed over (AC-2, I-110). */}
          <span className="cx-job-timeline-fault" data-testid={TESTIDS.job.timelineStepFault}>
            {step.faultId}
          </span>
        </p>
      )}
      <a className="cx-job-timeline-evidence cx-reticle" href={step.evidence.href}>
        {step.evidence.label}
      </a>
    </div>
  );
}
