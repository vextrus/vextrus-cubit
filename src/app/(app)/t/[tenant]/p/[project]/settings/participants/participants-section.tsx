"use client";
// S-Settings-Participants (R-SPINE-011): who holds which role on this project, the record of how
// that came to be, and the one form that moves a role. `preview` and `commit` replace the server
// actions and nothing else — given them, the screen maps the settlement exactly as it maps the real
// ones, which is what makes the screen a browser renders and the section a test renders one
// component (the SignInForm precedent).
//
// I-49: the screen pre-checks the preview and the dialog opens only on a consequence. A refusal
// before the dialog opens is this screen's answer, in its own slot; a refusal that arrives once the
// dialog holds focus is the dialog's, in its own.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
// The law itself, not the seam's barrel: L-ACT-03's roles are a value that touches no database
// (src/core/acts/law.ts), and a client component reaching through the barrel would drag the driver
// into the browser bundle.
import { ROLES } from "../../../../../../../../core/acts/law";
import { refusalOf, type RefusalCode } from "../../../../../../../../core/errors";
import { formatDate } from "../../../../../../../../core/format";
import { ConsequenceDialog } from "../../../../../../../../ui/patterns/consequence-dialog";
import { RefusalState } from "../../../../../../../../ui/patterns/refusal-state";
import { Button, Chip } from "../../../../../../../../ui/primitives/core";
import { shellHref } from "../../../../../../../../ui/shell";
import { fill, strings, type StringKey } from "../../../../../../../../ui/strings";
import { commitAssignRole, previewAssignRole, type CommitAnswer, type PreviewAnswer } from "./actions";
import { participantsRoute } from "./route-address";

/** The act this screen renders, and the two ways it moves a role (L-ACT-03, AC-1). */
const ACT_TYPE = "ASSIGN_PARTICIPANT_ROLE";
const DIRECTIONS = ["GRANT", "WITHDRAW"] as const;
type Direction = (typeof DIRECTIONS)[number];

/** A person this screen names: the id the act carries, and the label a reader recognises (I-51). */
export interface ParticipantsMember {
  readonly userId: string;
  readonly label: string;
}

/** One row of the current-roles list: a participant and the roles in force for them (I-52). */
export interface ParticipantsRosterRow extends ParticipantsMember {
  readonly roles: readonly string[];
}

/** One row of the record: what moved, whose it was, who moved it, and when. */
export interface ParticipantsHistoryRow {
  readonly direction: Direction;
  readonly role: string;
  readonly subject: ParticipantsMember;
  readonly actor: ParticipantsMember | null;
  /** The moment it happened, as an ISO instant — the screen states the day in the document's form. */
  readonly occurredAt: string;
}

export interface ParticipantsSectionProps {
  tenantId: string;
  projectId: string;
  roster: readonly ParticipantsRosterRow[];
  history: readonly ParticipantsHistoryRow[];
  subjects: readonly ParticipantsMember[];
  preview?: typeof previewAssignRole;
  commit?: typeof commitAssignRole;
}

/** What the submitted assignment is, once the screen has judged that one was actually stated. */
interface Assignment {
  readonly subjectUserId: string;
  readonly role: string;
  readonly direction: Direction;
}

/** Where a refusal is resolved: a place, named in the button voice (refusal-state § 3). */
interface Evidence {
  readonly href: string;
  readonly label: string;
}

export function ParticipantsSection({ tenantId, projectId, roster, history, subjects, preview = previewAssignRole, commit = commitAssignRole }: ParticipantsSectionProps) {
  const [subjectUserId, setSubjectUserId] = useState("");
  const [role, setRole] = useState("");
  const [direction, setDirection] = useState<Direction>("GRANT");
  const [pending, setPending] = useState(false);
  // What this screen judged of the last submission it did NOT send, and which field it was about.
  const [judged, setJudged] = useState<"member" | "role" | null>(null);
  // How many submissions this form has made: a judgement is about ONE submission, so pressing the
  // door again is a new event even when it is refused for the identical reason.
  const [attempt, setAttempt] = useState(0);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Whether the act this screen last carried through the dialog was written. An append-only act
  // that cannot be undone is not confirmed by a list quietly growing a row: the screen says so, in a
  // live region, so a reader who is not watching the record hears it too (R-UI-050).
  const [committed, setCommitted] = useState(false);
  const alertId = useId();
  const headingIds = { current: useId(), assign: useId(), history: useId() };
  const formRef = useRef<HTMLFormElement>(null);

  // A judged submission sends the person back to the fieldset that stopped it: a fieldset takes no
  // focus of its own, so the first chip — what a person would reach for it with, and what the tab
  // order already holds — is what takes it.
  useEffect(() => {
    if (judged === null) return;
    const group = formRef.current?.querySelector<HTMLElement>(`[data-testid="participants-assign-${judged === "member" ? "subject" : "role"}"]`);
    group?.querySelector<HTMLElement>("button")?.focus();
  }, [judged, attempt]);

  /**
   * Where each reachable refusal is resolved (Decision § 1). A code with no case of its own is
   * resolved by stating a different assignment on this very form, which is the honest place for an
   * act whose whole remedy is a different choice — silence never happens (R-UI-020).
   */
  const evidenceFor = useCallback(
    (code: RefusalCode): Evidence => {
      if (code === "PERMISSION_NOT_HELD") return { href: shellHref(tenantId, "projects"), label: strings.home_evidence_projects };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return { href: participantsRoute(tenantId, projectId), label: strings.spine_participants_evidence_assign };
    },
    [tenantId, projectId],
  );

  /** A refusal, in the shape the one act pattern rejects with and the one renderer composes (I-40). */
  const refused = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  /**
   * The label each member is named by on this screen, keyed by the id the act carries. The fold's
   * read-back happens once, on the server, for the roster and the subject list (I-51); this is that
   * same answer, indexed — no second resolution and no second spelling of it (B-17).
   */
  const labels = useMemo(() => new Map([...subjects, ...roster].map((member) => [member.userId, member.label] as const)), [subjects, roster]);

  const dialogPreview = useCallback(async () => {
    if (assignment === null) throw new Error("the consequence dialog was opened with no assignment to preview");
    const answered: PreviewAnswer = await preview({ projectId, ...assignment });
    if (!answered.previewed) throw refused(answered.refusal);
    // The seam names the subject by the id it moves the role for, which is the fact and the whole of
    // what the digest binds; the dialog is where a person decides, and it has to name them in the
    // words this screen already named them by. The label is attached here, at the layer that
    // resolved it, and the digest travels untouched (I-55).
    const named = {
      ...answered.consequence,
      subjects: answered.consequence.subjects.map((subject) => ({ ...subject, subjectLabel: labels.get(subject.subjectId) ?? subject.subjectId })),
    };
    return { consequence: named, consequenceDigest: answered.consequenceDigest };
  }, [assignment, labels, preview, projectId, refused]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      if (assignment === null) throw new Error("the consequence dialog committed with no assignment to carry");
      const answered: CommitAnswer = await commit({ projectId, ...assignment, consequenceDigest });
      if (!answered.committed) throw refused(answered.refusal);
      return { actId: answered.actId };
    },
    [assignment, commit, projectId, refused],
  );

  const submit = async (): Promise<void> => {
    // A preview is a round trip, and the door stays where it is while it is in flight: a second
    // submission would compute a second consequence for the same choice and open the dialog on
    // whichever answered last. The button reads as busy (`aria-busy`, R-UI-050) and this is what
    // makes the second press do nothing at all.
    if (pending) return;
    setAttempt((made) => made + 1);
    setRefusal(null);
    setCommitted(false);
    // Judged locally first (the s-home class): a submission naming no member or no role states no
    // assignment, so nothing is sent and the taxonomy stays closed (R-SPINE-062).
    if (subjectUserId === "" || role === "") {
      setJudged(subjectUserId === "" ? "member" : "role");
      return;
    }
    setJudged(null);
    setPending(true);
    const stated: Assignment = { subjectUserId, role, direction };
    const answered = await preview({ projectId, ...stated });
    setPending(false);
    if (!answered.previewed) {
      setRefusal(answered.refusal);
      return;
    }
    setAssignment(stated);
    setDialogOpen(true);
  };

  const invalidBy = (field: "member" | "role"): string | undefined => (judged === field ? alertId : undefined);

  return (
    <div className="cx-participants">
      <header className="cx-participants-header">
        <h1 className="cx-participants-heading">{strings.spine_participants_heading}</h1>
        <p className="cx-participants-caption">{strings.spine_participants_caption}</p>
      </header>

      <section aria-labelledby={headingIds.current}>
        <h2 className="cx-participants-section-heading" id={headingIds.current}>
          {strings.spine_participants_current_heading}
        </h2>
        <ul className="cx-participants-list" data-testid="participants-list">
          {roster.map((row) => (
            <li className="cx-participants-row" data-testid="participants-row" data-user={row.userId} key={row.userId}>
              <span className="cx-participants-member">{row.label}</span>
              <span className="cx-participants-roles">
                {row.roles.map((held) => (
                  <span className="cx-participants-role" key={held}>
                    {held}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={headingIds.assign}>
        <h2 className="cx-participants-section-heading" id={headingIds.assign}>
          {strings.spine_participants_assign_heading}
        </h2>
        <p className="cx-participants-hint">{strings.spine_participants_assign_hint}</p>
        <form
          className="cx-participants-form"
          data-testid="participants-assign-form"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {/* I-48: no Select ships and a native one could not wear the reticle, so each field is a
              fieldset of interactive Chips with exactly one pressed. */}
          <ChipField testId="participants-assign-subject" legend="spine_participants_field_member" alertId={invalidBy("member")}>
            {subjects.map((member) => (
              <Chip key={member.userId} selected={subjectUserId === member.userId} onClick={() => setSubjectUserId(member.userId)}>
                {member.label}
              </Chip>
            ))}
          </ChipField>

          <ChipField testId="participants-assign-role" legend="spine_participants_field_role" alertId={invalidBy("role")}>
            {ROLES.map((offered) => (
              <Chip key={offered} className="cx-participants-enum" selected={role === offered} onClick={() => setRole(offered)}>
                {offered}
              </Chip>
            ))}
          </ChipField>

          <ChipField testId="participants-assign-direction" legend="spine_participants_field_direction" alertId={undefined}>
            {DIRECTIONS.map((offered) => (
              <Chip key={offered} className="cx-participants-enum" selected={direction === offered} onClick={() => setDirection(offered)}>
                {offered}
              </Chip>
            ))}
          </ChipField>

          {/* The answer slot, before the submit: exactly one of the judged sentence and a settled
              refusal stands in it, and in flight neither does. */}
          <div data-testid="participants-refusal">
            {judged !== null && !pending ? (
              <p className="cx-participants-alert" role="alert" id={alertId}>
                {strings.spine_participants_assign_refusal}
              </p>
            ) : null}
            {refusal !== null && !pending ? <RefusalState refusal={refusalOf(refusal)} evidence={evidenceFor(refusal)} /> : null}
          </div>

          <Button type="submit" className="cx-participants-submit" loading={pending}>
            {strings.spine_participants_assign_submit}
          </Button>

          {/* The two states a round trip has beyond its answer: in flight, and written. Both are
              announced rather than only drawn — the act is irreversible, and the confirmation is
              what a reader who cannot see the record grow has instead (R-UI-050, R-UI-012). */}
          <p className="cx-participants-status" role="status" aria-live="polite">
            {pending ? strings.spine_participants_assign_pending : committed ? strings.spine_participants_assign_committed : ""}
          </p>
        </form>
      </section>

      <section aria-labelledby={headingIds.history}>
        <h2 className="cx-participants-section-heading" id={headingIds.history}>
          {strings.spine_participants_history_heading}
        </h2>
        <p className="cx-participants-hint">{strings.spine_participants_history_hint}</p>
        <ol className="cx-participants-history" data-testid="participants-history">
          {history.map((entry, index) => (
            <li
              className="cx-participants-history-row"
              data-testid="participants-history-row"
              data-direction={entry.direction}
              data-role={entry.role}
              key={`${entry.occurredAt}-${entry.direction}-${entry.role}-${entry.subject.userId}-${index}`}
            >
              <p className="cx-participants-history-what">
                <span className="cx-participants-direction">{entry.direction}</span>
                <span className="cx-participants-history-role">{entry.role}</span>
                <span className="cx-participants-history-subject">{entry.subject.label}</span>
              </p>
              {/* A grant a project's creation installed was performed by nobody — L-ACT-03 makes
                  the creating PRINCIPAL a bootstrap rather than an act — so the line says when it
                  happened and stops. "By an unnamed member" would name a performer that does not
                  exist, which is worse than saying less (B-21). */}
              <p className="cx-participants-history-by">
                {entry.actor === null
                  ? dayOf(entry.occurredAt)
                  : fill(strings.spine_participants_history_by, { actor: entry.actor.label, date: dayOf(entry.occurredAt) })}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <ConsequenceDialog
        open={dialogOpen}
        actType={ACT_TYPE}
        preview={dialogPreview}
        commit={dialogCommit}
        onOpenChange={setDialogOpen}
        onCommitted={() => {
          // The committed act is the visible answer: the roster and the record are re-read by the
          // revalidation the commit made, and the form goes back to its defaults so the surface does
          // not invite the same assignment twice (I-54).
          setSubjectUserId("");
          setRole("");
          setDirection("GRANT");
          setAssignment(null);
          setCommitted(true);
        }}
      />
    </div>
  );
}

/** One single-selection group: the legend is the field's label, and the chips are the choices. */
function ChipField({ testId, legend, alertId, children }: { testId: string; legend: StringKey; alertId: string | undefined; children: ReactNode }) {
  return (
    // A group takes `aria-invalid` where a fieldset takes no focus of its own: the judgement is
    // about the choice, so it is stated on the thing that holds the choices.
    <fieldset className="cx-participants-field" data-testid={testId} aria-invalid={alertId === undefined ? undefined : true} aria-describedby={alertId}>
      <legend className="cx-participants-field-label">{strings[legend]}</legend>
      <div className="cx-participants-choices">{children}</div>
    </fieldset>
  );
}

/** The day a movement happened, in the document's own form (L-FMT-01, the s-home I-37 class). */
function dayOf(occurredAt: string): string {
  const at = new Date(occurredAt);
  return formatDate({ year: at.getFullYear(), month: at.getMonth() + 1, day: at.getDate() });
}
