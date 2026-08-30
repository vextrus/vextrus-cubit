"use client";
/**
 * R-UI-021's act pattern, and its one home (B-17, ARCH-02): "every act opens a ConsequenceDialog
 * showing the typed consequence computed by the server; confirm is the act button and carries the
 * digest, shown as the digest line; a stale digest re-renders the dialog with what changed." Every
 * act flow in the product opens this component and adds none of its own.
 *
 * The dialog computes its own preview at every open (Decision I-41), so what a person confirms is
 * never older than the moment they were shown it — that currency is the point of the clause. The
 * consumer says only which act it is and how to preview and commit it; nothing act-specific is
 * spelled here, because the Consequence carries what the act would do and the act type names it.
 *
 * ARCH-01: the refusal registry is core, and this layer holds no value import of it. A refusal
 * therefore arrives as a rejection already carrying its registered entry and its evidence — the
 * consumer's wrapper does the lookup — and is rendered by the one RefusalState, with no chrome of
 * this component's own (Decision I-40).
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Consequence, ConsequenceRendering, ConsequenceSubject } from "../../../core/acts";
import type { RefusalCode, RefusalEntry } from "../../../core/errors";
import { Button, Skeleton } from "../../primitives/core";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "../../primitives/overlay";
import { RefusalState } from "../refusal-state";
import { strings } from "../../strings";

import "./consequence-dialog.css";

/** What a preview answers: the typed Consequence the server computed, and the digest that binds it. */
export interface ConsequencePreview {
  readonly consequence: Consequence;
  readonly consequenceDigest: string;
}

/** What a commit answers: the act it wrote, which is what the consumer refreshes its surfaces on. */
export interface CommittedAct {
  readonly actId: string;
}

/** Where a refusal is resolved — the shape RefusalState composes, carried by the rejection (I-40). */
interface RefusedAnswer {
  readonly refusal: RefusalEntry;
  readonly evidence: { readonly href: string; readonly label: string };
}

export interface ConsequenceDialogProps {
  open: boolean;
  /** The act type, verbatim: a machine identifier the dialog shows and never translates. */
  actType: string;
  preview: () => Promise<ConsequencePreview>;
  commit: (carried: { consequenceDigest: string }) => Promise<CommittedAct>;
  onOpenChange: (open: boolean) => void;
  onCommitted: (committed: CommittedAct) => void;
}

/**
 * I-44: "a stale digest is answered by re-render, never by a refusal card." The code is compared
 * against the registry's own union, so a code renamed there is a compile error here rather than a
 * comparison that quietly stops matching (B-17).
 */
const STALE: RefusalCode = "CONSEQUENCES_NOT_CARRIED";

/** The bones that keep the layout while a preview is in flight (Decision § 1). */
const SUBJECT_BONES = [
  { height: "16px", width: "min(360px, 100%)" },
  { height: "16px", width: "min(360px, 100%)" },
];
const DIGEST_BONE = { height: "12px", width: "240px" };
const CONFIRM_BONE = { height: "32px", width: "96px" };

/** Is this rejection a refusal the product registered, or a failure the error boundary owns? */
function refusedAnswerOf(thrown: unknown): RefusedAnswer | null {
  if (typeof thrown !== "object" || thrown === null) return null;
  const { refusal, evidence } = thrown as Partial<RefusedAnswer>;
  if (typeof refusal !== "object" || refusal === null || typeof refusal.code !== "string") return null;
  if (typeof evidence !== "object" || evidence === null || typeof evidence.href !== "string" || typeof evidence.label !== "string") return null;
  return { refusal, evidence };
}

/** What the body is showing right now. Every arm is reachable through the props (Decision § 2). */
type Body =
  | { readonly phase: "pending" }
  | { readonly phase: "consequence"; readonly consequence: Consequence; readonly digest: string }
  | { readonly phase: "refused"; readonly answer: RefusedAnswer };

export function ConsequenceDialog({ open, actType, preview, commit, onOpenChange, onCommitted }: ConsequenceDialogProps) {
  const [body, setBody] = useState<Body>({ phase: "pending" });
  const [stale, setStale] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitRefusal, setCommitRefusal] = useState<RefusedAnswer | null>(null);
  // A failure that is not a registered refusal is a fault, and a fault belongs to the error
  // boundary. Raising it from render is what puts it there: a rejected promise inside a handler
  // reaches no boundary at all, and a swallowed one would leave a dialog sitting on nothing.
  const [fault, setFault] = useState<unknown>(null);
  // The hint is what describes the dialog to assistive technology, and two dialogs mounted on one
  // page must not both claim the same id (R-UI-012).
  const hintId = useId();

  // Which opening a preview belongs to. An answer for an opening the person has already left must
  // not paint over the one they are looking at now.
  const opening = useRef(0);

  const runPreview = useCallback(async (): Promise<void> => {
    opening.current += 1;
    const mine = opening.current;
    setBody({ phase: "pending" });
    setCommitRefusal(null);
    try {
      const answered = await preview();
      if (opening.current !== mine) return;
      setBody({ phase: "consequence", consequence: answered.consequence, digest: answered.consequenceDigest });
    } catch (thrown) {
      if (opening.current !== mine) return;
      const refused = refusedAnswerOf(thrown);
      if (refused === null) setFault(thrown);
      else setBody({ phase: "refused", answer: refused });
    }
  }, [preview]);

  useEffect(() => {
    if (!open) {
      opening.current += 1;
      setStale(false);
      setCommitting(false);
      setCommitRefusal(null);
      setBody({ phase: "pending" });
      return;
    }
    void runPreview();
  }, [open, runPreview]);

  if (fault !== null) throw fault;

  const confirm = async (digest: string): Promise<void> => {
    setCommitting(true);
    setCommitRefusal(null);
    try {
      const written = await commit({ consequenceDigest: digest });
      setCommitting(false);
      onCommitted(written);
      onOpenChange(false);
    } catch (thrown) {
      setCommitting(false);
      const refused = refusedAnswerOf(thrown);
      if (refused === null) {
        setFault(thrown);
        return;
      }
      // The superseded consequence, its digest line and the confirm unmount at once: a confirm may
      // never stand beside a digest the current state does not produce (I-44).
      if (refused.refusal.code === STALE) {
        setStale(true);
        void runPreview();
        return;
      }
      setCommitRefusal(refused);
    }
  };

  const pending = body.phase === "pending";
  const shown = body.phase === "consequence" ? body : null;
  const answer = body.phase === "refused" ? body.answer : commitRefusal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={hintId}>
        <div className="cx-consequence" data-testid="consequence-dialog" data-act-type={actType} aria-busy={pending || undefined}>
          {/* The enum value verbatim: a machine identifier, and the title is what names the dialog. */}
          <p className="cx-consequence-acttype" aria-hidden="true">
            {actType}
          </p>
          <DialogTitle>{strings.consequence_dialog_title}</DialogTitle>
          <p className="cx-consequence-hint" id={hintId}>
            {strings.consequence_dialog_hint}
          </p>

          {stale ? (
            <div className="cx-consequence-stale" data-testid="consequence-stale-notice" role="alert">
              {strings.consequence_dialog_stale}
            </div>
          ) : null}

          {shown === null ? (
            <div className="cx-consequence-bones">
              {pending
                ? SUBJECT_BONES.map((bone, index) => <Skeleton key={`subject-${index}`} style={bone} />)
                : null}
              {pending ? <Skeleton style={DIGEST_BONE} /> : null}
            </div>
          ) : (
            <>
              <ConsequenceBody consequence={shown.consequence} />
              <p className="cx-consequence-digest">
                <span className="cx-consequence-digest-label">{strings.consequence_dialog_digest_label}</span>
                <span data-testid="consequence-digest-line">{shown.digest}</span>
              </p>
            </>
          )}

          {answer === null ? null : <RefusalState refusal={answer.refusal} evidence={answer.evidence} />}

          <footer className="cx-consequence-footer">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {strings.consequence_dialog_cancel}
            </Button>
            {shown === null ? (
              pending ? <Skeleton style={CONFIRM_BONE} /> : null
            ) : (
              <Button
                variant="act"
                loading={committing}
                data-testid="consequence-confirm"
                data-digest={shown.digest}
                onClick={() => {
                  void confirm(shown.digest);
                }}
              >
                {strings.consequence_dialog_confirm}
              </Button>
            )}
          </footer>
          <DialogClose aria-label={strings.consequence_dialog_close} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * I-45: the consequence rendering is a total map. L-ACT-02 makes an act type without a rendering a
 * compile error, and this component is where acts render — so the body is an exhaustive switch over
 * the Consequence's closed rendering arms. Today there is one: subjects with before/after lists. A
 * later act whose Consequence renders a different shape (L-ACT-02's offered groups, R-UI-023) adds
 * its arm to `ConsequenceRendering` and its case here, or `unrendered` fails to compile.
 */
function ConsequenceBody({ consequence }: { consequence: Consequence }) {
  const arm: ConsequenceRendering = consequence.rendering ?? "SUBJECTS";
  switch (arm) {
    case "SUBJECTS":
      return (
        <ul className="cx-consequence-subjects">
          {consequence.subjects.map((subject) => (
            <SubjectRow key={subject.subjectId} subject={subject} />
          ))}
        </ul>
      );
    default:
      return unrendered(arm);
  }
}

/**
 * The compile error itself: an arm with no case above reaches here as something other than `never`,
 * and no act type ships a rendering this component does not have (L-ACT-02).
 */
function unrendered(arm: never): never {
  throw new Error(`a Consequence rendered as ${JSON.stringify(arm)}, which this dialog has no rendering for (L-ACT-02)`);
}

/**
 * One fact the act judges, rendered as the transition it is: what the subject holds now under one
 * label, what they would hold under the other. A role list would say what is true without saying
 * what changes, which is the half R-UI-021 asks for.
 *
 * The heading is the label the answering layer resolved for the subject, and the id it carries when
 * none was — the id is what the act moves and is always true, but the one surface where a person
 * decides has to name the person in the words the rest of the screen named them by.
 */
function SubjectRow({ subject }: { subject: ConsequenceSubject }) {
  return (
    <li className="cx-consequence-subject" data-testid="consequence-subject-row" data-subject={subject.subjectId}>
      <p className="cx-consequence-subject-label">{subject.subjectLabel ?? subject.subjectId}</p>
      <div className="cx-consequence-roles">
        <div className="cx-consequence-column">
          <span className="cx-consequence-column-label">{strings.consequence_dialog_before_label}</span>
          <RoleList roles={subject.before} variant="before" />
        </div>
        <div className="cx-consequence-column">
          <span className="cx-consequence-column-label">{strings.consequence_dialog_after_label}</span>
          <RoleList roles={subject.after} variant="after" />
        </div>
      </div>
    </li>
  );
}

/** The role enum values verbatim, or prose standing for absence — never a fake role name. */
function RoleList({ roles, variant }: { roles: readonly string[]; variant: "before" | "after" }) {
  if (roles.length === 0) return <span className="cx-consequence-none">{strings.consequence_dialog_none}</span>;
  return (
    <span className="cx-consequence-role-list" data-column={variant}>
      {roles.join(" ")}
    </span>
  );
}
