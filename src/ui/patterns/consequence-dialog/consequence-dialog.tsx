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
 *
 * What the consequence says is `ConsequenceSummary`'s to render (I-447, the second half of this
 * file): the dialog is its frame — the act named in words, the title, the currency hint, the stale
 * notice, the refusal slot and the two buttons — so a surface that previews an act inline reads the
 * same consequence the same way.
 */
import { Fragment, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type {
  ActType,
  Consequence,
  ConsequenceLineGroup,
  ConsequenceRendering,
  ConsequenceStanding,
  ConsequenceSubject,
  StandingOfSubject,
} from "@/core/acts";
import type { RefusalCode, RefusalEntry } from "@/core/errors";
import type { LevelSlot } from "@/core/identity";
import type { StoreyHeightStandingName } from "@/core/levels";
import { Button, Skeleton, UnitBadge } from "../../primitives/core";
import { humaniseEnum } from "../../primitives/core/enum-label";
import { useFigureContext } from "../../primitives/core/figures";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "../../primitives/overlay";
import { RefusalState } from "../refusal-state";
import { fill, strings } from "../../strings";

import "./consequence-dialog.css";
import { TESTIDS } from "@/ui/testids";

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
  /**
   * The act type, verbatim: the machine identifier the wrapper publishes on `data-act-type` and the
   * Details disclosure states. What a person reads is the act's name in words (I-444).
   */
  actType: string;
  preview: () => Promise<ConsequencePreview>;
  commit: (carried: { consequenceDigest: string }) => Promise<CommittedAct>;
  onOpenChange: (open: boolean) => void;
  onCommitted: (committed: CommittedAct) => void;
  /**
   * Where the dialog is portalled, for the one consumer that needs it elsewhere than the document's
   * body (Decision I-167): a screen whose act is raised from a region of itself may ask that the
   * dialog stand inside that screen's own root, so what the screen shows is the whole of what its
   * subtree holds. Unset — which is every act that shipped before this one — it is `document.body`,
   * and their DOM is untouched.
   */
  container?: HTMLElement | null;
}

/**
 * I-44: "a stale digest is answered by re-render, never by a refusal card." The code is compared
 * against the registry's own union, so a code renamed there is a compile error here rather than a
 * comparison that quietly stops matching (B-17).
 */
const STALE: RefusalCode = "CONSEQUENCES_NOT_CARRIED";

/**
 * I-444: every act's name in words, the name its own door already uses. Keyed by the act-type
 * enum itself and by nothing wider, so an act added to L-ACT-02's map without a name here is a
 * compile error rather than an enum shown to a person (R-UI-082).
 */
const ACT_WORDS: { readonly [T in ActType]: string } = {
  ASSIGN_PARTICIPANT_ROLE: strings.consequence_dialog_act_assign_participant_role,
  CONFIRM_DISCIPLINE: strings.consequence_dialog_act_confirm_discipline,
  CONFIRM_VIEW_TYPE: strings.consequence_dialog_act_confirm_view_type,
  PIN_DRAWING_SET: strings.consequence_dialog_act_pin_drawing_set,
  AFFIRM_SCALE: strings.consequence_dialog_act_affirm_scale,
  INSERT_LEVEL: strings.consequence_dialog_act_insert_level,
  REPUDIATE_LEVEL: strings.consequence_dialog_act_repudiate_level,
  AUTHOR_STOREY_HEIGHT: strings.consequence_dialog_act_author_storey_height,
  AUTHOR_TYPICAL_RANGE: strings.consequence_dialog_act_author_typical_range,
  TRANSCRIBE_SHEET_NOTES: strings.consequence_dialog_act_transcribe_sheet_notes,
  CORROBORATE: strings.consequence_dialog_act_corroborate,
  REPUDIATE: strings.consequence_dialog_act_repudiate,
  HOLD_OUT_OF_BILL: strings.consequence_dialog_act_hold_out_of_bill,
  DECLARE_NOT_IN_PROJECT_SCOPE: strings.consequence_dialog_act_declare_not_in_project_scope,
  AUTHOR_RULESET_EDITION: strings.consequence_dialog_act_author_ruleset_edition,
  AUTHOR_SITE_FACT: strings.consequence_dialog_act_author_site_fact,
  RECORD_MANUAL_MEASUREMENT: strings.consequence_dialog_act_record_manual_measurement,
};

/**
 * The act as a person reads it. The prop is a string, so a value the enum does not hold — which no
 * shipped consumer passes — is still said in words by the one mechanical rule, never shown raw.
 */
function actWords(actType: string): string {
  return (ACT_WORDS as Readonly<Record<string, string>>)[actType] ?? humaniseEnum(actType);
}

/** The bones that keep the layout while a preview is in flight (Decision § 1). */
const SUBJECT_BONES = [
  { height: "16px", width: "min(360px, 100%)" },
  { height: "16px", width: "min(360px, 100%)" },
];
const DIGEST_BONE = { height: "12px", width: "240px" };
const CONFIRM_BONE = { height: "32px", width: "96px" };

/**
 * What "the first control" means, in one place: the first thing in the dialog a person can act on,
 * in the order the document holds them. Direction 00 §1 rules initial focus onto it — the primitive
 * focuses the content box itself when nothing claims focus, and a reticle drawn around the whole
 * body says "this card is the thing you are on" when what is true is "the first control is".
 *
 * The confirm is deliberately NOT autofocused and cannot be reached by this: it stands after the
 * cancel in the footer, and an act button under a pre-focused Enter would commit by accident
 * (Decision § 1). While the preview is in flight it does not exist at all.
 */
const FIRST_CONTROL = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

export function ConsequenceDialog({ open, actType, preview, commit, onOpenChange, onCommitted, container }: ConsequenceDialogProps) {
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
  // What held focus when the dialog opened — the door that raised the act. The primitive returns
  // focus to its own trigger, and this dialog is opened by a consumer's door rather than one, so
  // without this a close dropped focus onto the document body (R-UI-060, I-448).
  const opener = useRef<HTMLElement | null>(null);

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
      <DialogContent
        aria-describedby={hintId}
        container={container}
        // Focus the first control, not the container (Direction 00 §1; the Decision's drift note).
        // `currentTarget` is the content box the primitive would otherwise have focused, so nothing
        // outside the dialog is ever reached — and where the card somehow holds no control at all,
        // the default stands rather than leaving focus on the document.
        onOpenAutoFocus={(event) => {
          // Read before anything moves it: at this moment focus is still on the door that opened us.
          const held = typeof document === "undefined" ? null : document.activeElement;
          opener.current = held instanceof HTMLElement && held !== document.body ? held : null;
          const first = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(FIRST_CONTROL);
          if (first === null || first === undefined) return;
          event.preventDefault();
          first.focus();
        }}
        // Focus goes back to the door that raised the act (R-UI-060, I-448) — but only where it
        // has nowhere else to be. A consumer that placed focus deliberately once the act landed (on
        // the row it just wrote, say) keeps it, and a door the act's own commit took away is no
        // longer in the document, so focus stays where the primitive leaves it.
        onCloseAutoFocus={(event) => {
          const door = opener.current;
          opener.current = null;
          if (door === null || !door.isConnected) return;
          const current = document.activeElement;
          const placed = current !== null && current !== document.body && current.isConnected;
          if (placed) return;
          event.preventDefault();
          door.focus();
        }}
      >
        <div className="cx-consequence" data-testid={TESTIDS.consequence.dialog} data-act-type={actType} aria-busy={pending || undefined}>
          {/* The act in the words its door uses (I-444); the enum stays on data-act-type and in Details. */}
          <p className="cx-consequence-acttype">{actWords(actType)}</p>
          <DialogTitle>{strings.consequence_dialog_title}</DialogTitle>
          <p className="cx-consequence-hint" id={hintId}>
            {strings.consequence_dialog_hint}
          </p>

          {stale ? (
            <div className="cx-consequence-stale" data-testid={TESTIDS.consequence.staleNotice} role="alert">
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
            <ConsequenceSummary consequence={shown.consequence} digest={shown.digest} />
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
                data-testid={TESTIDS.consequence.confirm}
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

/* ------------------------------------------------------------------ the consequence itself */

/*
 * The typed consequence, as a quantity surveyor reads it (Decision § 1, I-445/c/d): what each
 * subject stands at before and after, the lines that move counted by class, kind and level, and —
 * one press away, never as body text — the identifiers and the digest a machine compares (R-UI-082).
 *
 * It is the dialog's body, published on its own so a surface that previews an act inline rather than
 * in a modal (S-Measure's card is the first) reads a consequence in exactly this form and adds none
 * of its own (B-17). It renders what the seam computed and decides nothing: every word an act needs
 * arrives in the Consequence, and every figure through the injected conventions.
 */

export interface ConsequenceSummaryProps {
  /** The Consequence the server computed. */
  consequence: Consequence;
  /** The digest that binds it — shown whole inside the Details disclosure, never as body text. */
  digest: string;
}

/**
 * The standings a level's height is judged in (L-MEA-07's roster), and the words each is read by.
 * Keyed by the roster's own name type, so a standing added there without words here is a compile
 * error rather than an enum shown to a person (R-UI-082, as ACT_WORDS is).
 */
const STANDING_WORDS: { readonly [S in StoreyHeightStandingName]: string } = {
  AGREED: strings.consequence_dialog_standing_agreed,
  SUSPENDED: strings.consequence_dialog_standing_suspended,
  NONE: strings.consequence_dialog_standing_none,
};

/** The one standing whose readings disagree — the only one whose count is said as a disagreement. */
const SUSPENDED: StoreyHeightStandingName = "SUSPENDED";

/** The lawful-null level slots (L-REG-04), in the words a level column says them in — total over the roster. */
const SLOT_WORDS: { readonly [S in LevelSlot]: string } = {
  FOUNDATION: strings.consequence_dialog_level_foundation,
  UNRESOLVED: strings.consequence_dialog_level_unresolved,
};

/** A value's words off one of the tables above; a value no roster holds is said by EnumLabel's rule, never raw. */
function wordsFor(table: Readonly<Record<string, string>>, value: string): string {
  return table[value] ?? humaniseEnum(value);
}

/** A count said with its noun, one and many, grouped by the document's conventions. */
function counted(count: number, one: string, many: string, figure: (value: string) => string): string {
  return count === 1 ? one : fill(many, { count: figure(String(count)) });
}

/**
 * The document's figure conventions where the frame installed them, else the exact decimal. The
 * pattern formats nothing itself (ARCH-01): a figure with no conventions around it is shown as the
 * exact string it arrived as, the DataTable subtotal's own rule, and never re-grouped here.
 */
function useFigure(): (value: string) => string {
  const conventions = useFigureContext();
  return conventions === null ? (value) => value : (value) => conventions.figure(value);
}

export function ConsequenceSummary({ consequence, digest }: ConsequenceSummaryProps): ReactNode {
  return (
    <>
      <ConsequenceSubjects consequence={consequence} />
      <ConsequenceEffects effects={consequence.effects} />
      <ConsequenceDetails actType={consequence.actType} digest={digest} />
    </>
  );
}

/**
 * I-45: the consequence rendering is a total map. L-ACT-02 makes an act type without a rendering a
 * compile error, and this component is where acts render — so the subjects render by an exhaustive
 * switch over the Consequence's closed rendering arms, each named by the Consequence itself and never
 * defaulted here. An arm added to `ConsequenceRendering` (L-ACT-02's offered groups, R-UI-023) owes
 * its case below, or `unrendered` fails to compile.
 */
function ConsequenceSubjects({ consequence }: { consequence: Consequence }): ReactNode {
  const arm: ConsequenceRendering = consequence.rendering;
  switch (arm) {
    // A hand measurement's subjects are the register row it adds and, on an edit, the one it strikes
    // (s-measure I-373); the card at the closing point renders the arm's payload around them.
    case "SUBJECTS":
    case "MEASUREMENT":
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
 * label, what it would hold under the other. Where the act's kind judges a STANDING — a storey
 * height agreed or suspended over its readings — the columns say the standing and the figure the
 * act records stands under them (I-445); otherwise they list what the subject holds, verbatim.
 *
 * The heading is the label the answering layer resolved for the subject, and the id it carries when
 * none was — the id is what the act moves and is always true.
 */
function SubjectRow({ subject }: { subject: ConsequenceSubject }): ReactNode {
  const standing = subject.standing;
  return (
    <li
      className="cx-consequence-subject"
      data-testid={TESTIDS.consequence.subjectRow}
      data-subject={subject.subjectId}
      data-standing-before={standing?.before.standing}
      data-standing-after={standing?.after.standing}
    >
      <p className="cx-consequence-subject-label">{subject.subjectLabel ?? subject.subjectId}</p>
      <div className="cx-consequence-roles">
        <div className="cx-consequence-column">
          <span className="cx-consequence-column-label">{strings.consequence_dialog_before_label}</span>
          {standing === undefined ? <RoleList roles={subject.before} variant="before" /> : <Standing held={standing.before} variant="before" />}
        </div>
        <div className="cx-consequence-column">
          <span className="cx-consequence-column-label">{strings.consequence_dialog_after_label}</span>
          {standing === undefined ? <RoleList roles={subject.after} variant="after" /> : <Standing held={standing.after} variant="after" />}
        </div>
      </div>
      {standing === undefined ? null : <Recorded standing={standing} />}
    </li>
  );
}

/** What the subject holds, verbatim, or prose standing for absence — never a fake role name. */
function RoleList({ roles, variant }: { roles: readonly string[]; variant: "before" | "after" }): ReactNode {
  if (roles.length === 0) return <span className="cx-consequence-none">{strings.consequence_dialog_none}</span>;
  return (
    <span className="cx-consequence-role-list" data-column={variant}>
      {roles.join(" ")}
    </span>
  );
}

/**
 * One standing in words: its name, the figure and unit it stands at where it stands at one, and the
 * readings behind it — "Agreed 3.3528 m · 2 readings", "Suspended · 3 readings do not agree". The
 * figure is the exact metres the standing holds, never a rounded face: what a person confirms is
 * the value the stack will carry (L-QTY-03).
 */
function Standing({ held, variant }: { held: StandingOfSubject; variant: "before" | "after" }): ReactNode {
  const figure = useFigure();
  const readings =
    held.readings === 0
      ? strings.consequence_dialog_standing_unread
      : held.standing === SUSPENDED
        ? fill(strings.consequence_dialog_standing_disagree, { count: figure(String(held.readings)) })
        : counted(held.readings, strings.consequence_dialog_standing_readings_one, strings.consequence_dialog_standing_readings, figure);
  return (
    <span className="cx-consequence-standing" data-column={variant} data-standing={held.standing} data-value={held.value ?? ""}>
      <span className="cx-consequence-standing-state">
        <span className="cx-consequence-standing-word">{wordsFor(STANDING_WORDS, held.standing)}</span>
        {held.value === null ? null : (
          <span className="cx-consequence-figure">
            {figure(held.value)}
            <UnitBadge unit={held.unit} />
          </span>
        )}
      </span>
      <span className="cx-consequence-standing-readings">{readings}</span>
    </span>
  );
}

/** The figure the act records, under the columns it moves: the one number the person typed or read. */
function Recorded({ standing }: { standing: ConsequenceStanding }): ReactNode {
  const figure = useFigure();
  return (
    <p className="cx-consequence-recorded" data-value={standing.recorded.value}>
      <span className="cx-consequence-column-label">{strings.consequence_dialog_standing_recorded}</span>
      <span className="cx-consequence-figure">
        {figure(standing.recorded.value)}
        <UnitBadge unit={standing.recorded.unit} />
      </span>
    </p>
  );
}

/**
 * I-161: the effect slots mount exactly when the seam sends them. A preview that carries no
 * `effects` field mounts neither slot and no heading: what an act's kind derives is the seam's
 * answer, not this component's guess (R-TO-020).
 *
 * I-446: each slot says what moves the way a reader counts it — the lines by class, kind and
 * level, the signatures by count — and keeps the identifiers themselves inside the slot, one press
 * away, whole and selectable (R-UI-082): a reader can still carry an id to the register.
 */
function ConsequenceEffects({ effects }: { effects: Consequence["effects"] }): ReactNode {
  const figure = useFigure();
  if (effects === undefined) return null;
  return (
    <section className="cx-consequence-effects-block">
      <h3 className="cx-consequence-effects-heading">{strings.consequence_dialog_effects_heading}</h3>
      <dl className="cx-consequence-effects">
        <dt className="cx-consequence-effects-label">{strings.consequence_dialog_effects_lines}</dt>
        <dd className="cx-consequence-effects-value" data-testid={TESTIDS.consequence.effectLines} data-count={effects.linesRederiving.length}>
          {effects.linesRederiving.length === 0 ? (
            <span className="cx-consequence-none">{strings.consequence_dialog_none}</span>
          ) : (
            <>
              {effects.lineGroups === undefined ? (
                <span className="cx-consequence-count">
                  {counted(effects.linesRederiving.length, strings.consequence_dialog_lines_one, strings.consequence_dialog_lines, figure)}
                </span>
              ) : (
                <LineGroups groups={effects.lineGroups} total={effects.linesRederiving.length} figure={figure} />
              )}
              <IdList summary={strings.consequence_dialog_details_lines} ids={effects.linesRederiving} />
            </>
          )}
        </dd>
        <dt className="cx-consequence-effects-label">{strings.consequence_dialog_effects_signatures}</dt>
        <dd className="cx-consequence-effects-value" data-testid={TESTIDS.consequence.effectSignatures} data-count={effects.signaturesVoiding.length}>
          {effects.signaturesVoiding.length === 0 ? (
            <span className="cx-consequence-none">{strings.consequence_dialog_none}</span>
          ) : (
            <>
              <span className="cx-consequence-count">
                {counted(effects.signaturesVoiding.length, strings.consequence_dialog_signatures_one, strings.consequence_dialog_signatures, figure)}
              </span>
              <IdList summary={strings.consequence_dialog_details_signatures} ids={effects.signaturesVoiding} />
            </>
          )}
        </dd>
      </dl>
    </section>
  );
}

/** Where a group's objects stand, in the words a level column says it: a label, a slot, or none. */
function levelWords(group: ConsequenceLineGroup): string {
  if (group.levelSlot !== null && group.levelLabel === null) return wordsFor(SLOT_WORDS, group.levelSlot);
  return group.levelLabel ?? strings.consequence_dialog_level_none;
}

/**
 * The lines, one row per (class, kind, level) in the order the seam counted them — up the building,
 * then the bill's own order — with the count right-aligned in the figure face, and the total beneath
 * them where there is more than one row to add up.
 */
function LineGroups({ groups, total, figure }: { groups: readonly ConsequenceLineGroup[]; total: number; figure: (value: string) => string }): ReactNode {
  return (
    <ul className="cx-consequence-groups">
      {groups.map((group) => (
        <li
          key={`${group.elementClass}|${group.kind}|${group.levelSlot ?? ""}|${group.levelLabel ?? ""}`}
          className="cx-consequence-group"
          data-testid={TESTIDS.consequence.effectGroup}
          data-class={group.elementClass}
          data-kind={group.kind}
          data-level={group.levelLabel ?? group.levelSlot ?? ""}
          data-count={group.count}
        >
          <span className="cx-consequence-group-what">{group.description}</span>
          <span className="cx-consequence-group-where">{levelWords(group)}</span>
          <span className="cx-consequence-group-count">{counted(group.count, strings.consequence_dialog_lines_one, strings.consequence_dialog_lines, figure)}</span>
        </li>
      ))}
      {groups.length > 1 ? (
        <li className="cx-consequence-group cx-consequence-group-total">
          <span className="cx-consequence-group-count">{fill(strings.consequence_dialog_lines_total, { count: figure(String(total)) })}</span>
        </li>
      ) : null}
    </ul>
  );
}

/**
 * The identifiers a slot names, whole and selectable, behind the disclosure R-UI-082 names. Each id
 * is one unbreakable run, so an opened list reads one id at a time rather than wrapping a UUID at its
 * hyphens; the runs are space-separated, so the slot's text is still exactly the ids, space-joined.
 */
function IdList({ summary, ids }: { summary: string; ids: readonly string[] }): ReactNode {
  return (
    <details className="cx-consequence-ids">
      <summary className="cx-consequence-disclosure cx-reticle">{summary}</summary>
      <span className="cx-consequence-effect-list" data-technical="">
        {ids.map((id, at) => (
          <Fragment key={`${at}:${id}`}>
            {at === 0 ? null : " "}
            <span className="cx-consequence-id">{id}</span>
          </Fragment>
        ))}
      </span>
    </details>
  );
}

/**
 * I-447: the act's own code and the digest the confirm carries — what a machine compares and a
 * person does not need in order to decide — stand in one data-technical disclosure (R-UI-082),
 * whole and selectable. The digest line keeps its id and holds exactly the digest (I-43), so the
 * confirm's `data-digest` and this line can still be compared character for character.
 */
function ConsequenceDetails({ actType, digest }: { actType: string; digest: string }): ReactNode {
  return (
    <details className="cx-consequence-details">
      <summary className="cx-consequence-disclosure cx-reticle" data-testid={TESTIDS.consequence.details}>
        {strings.consequence_dialog_details}
      </summary>
      <dl className="cx-consequence-technical">
        <dt className="cx-consequence-effects-label">{strings.consequence_dialog_details_act}</dt>
        <dd className="cx-consequence-technical-value" data-technical="">
          {actType}
        </dd>
        <dt className="cx-consequence-effects-label">{strings.consequence_dialog_digest_label}</dt>
        <dd className="cx-consequence-technical-value cx-consequence-digest">
          <span data-testid={TESTIDS.consequence.digestLine} data-technical="">
            {digest}
          </span>
        </dd>
      </dl>
    </details>
  );
}
