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
  ConsequenceHeld,
  ConsequenceLineGroup,
  ConsequenceMeasurement,
  ConsequencePinning,
  ConsequenceRendering,
  ConsequenceStanding,
  ConsequenceSubject,
  OfferedFigure,
  ScaleOfSubject,
  StandingOfSubject,
} from "@/core/acts";
import type { RefusalCode, RefusalEntry } from "@/core/errors";
import type { LevelSlot } from "@/core/identity";
import type { HandLevel } from "@/core/manual/law";
import type { FormulaParts } from "@/core/offers/formula";
import type { StoreyHeightStandingName } from "@/core/levels";
import type { Discipline } from "@/core/sheets";
import type { ScaleRank } from "@/core/scale";
import { BasisChip, Button, IdChip, Skeleton, UnitBadge } from "../../primitives/core";
import { BASIS_GLYPHS, type Basis } from "../../primitives/core/basis";
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
  /**
   * What the person may change about the act before confirming it, rendered above the consequence
   * (s-measure § 2.5: the card's level, readings and cut-out roles). A change is the consumer's to
   * carry into `preview`, whose new identity re-previews the dialog (I-41): what is confirmed is never
   * older than what it was changed to. Unset — every act before S-Measure's card — nothing renders.
   */
  controls?: ReactNode;
  /**
   * Where the dialog stands, in viewport pixels, when a consumer anchors it to what raised it (the
   * card at a measurement's closing point, s-measure § 2.5, I-618); unset, it stands where every
   * dialog does. The consumer computes the place; the dialog only stands there.
   */
  anchor?: { readonly left: number; readonly top: number } | null;
  /**
   * How a hand measurement's figures and words are said (s-measure I-662), handed in by the
   * one consumer that previews one — the card — because the pattern formats nothing (ARCH-01): a
   * kind's figure at its document places, a formula taken apart, a variable at the places a QS reads
   * it, the level by its label. Unset, the MEASUREMENT arm shows each figure exact and grouped.
   */
  measurementFaces?: MeasurementFaces;
}

/** The readings the card hands the MEASUREMENT arm, each answered at the app's edge (I-662). */
export interface MeasurementFaces {
  /** A kind's figure at the places its kind is written to, grouped: `23.195`. */
  quantity(value: string, kind: string): string;
  /** The gate's formula sentence taken apart, or null where it cannot be — it then stands verbatim. */
  formula(formula: string): FormulaParts | null;
  /** A variable's reading at the places a QS reads it, in the unit a QS reads it in: `328.838` m2. */
  variable(value: string, unit: string): { readonly value: string; readonly unit: string };
  /** The level the measurement stands on, by the label the stack gives it, or null where none is known. */
  level(level: HandLevel): string | null;
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
  CONFIRM_ROOMS: strings.consequence_dialog_act_confirm_rooms,
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

export function ConsequenceDialog({ open, actType, preview, commit, onOpenChange, onCommitted, container, controls, anchor = null, measurementFaces }: ConsequenceDialogProps) {
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
        className={anchor === null ? undefined : "cx-consequence-anchored"}
        style={anchor === null ? undefined : { left: `${anchor.left}px`, top: `${anchor.top}px` }}
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
        <div className="cx-consequence" data-testid={TESTIDS.consequence.dialog} data-act-type={actType} data-presentation={anchor === null ? undefined : "anchored"} aria-busy={pending || undefined}>
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

          {controls === undefined ? null : <div className="cx-consequence-controls">{controls}</div>}

          {shown === null ? (
            <div className="cx-consequence-bones">
              {pending
                ? SUBJECT_BONES.map((bone, index) => <Skeleton key={`subject-${index}`} style={bone} />)
                : null}
              {pending ? <Skeleton style={DIGEST_BONE} /> : null}
            </div>
          ) : (
            <ConsequenceSummary consequence={shown.consequence} digest={shown.digest} measurementFaces={measurementFaces} />
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
  /** How a hand measurement's figures and words are said, where a consumer hands them in (I-662). */
  measurementFaces?: MeasurementFaces;
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

/**
 * The ranks of L-MEA-05's precedence, in the words a scale is read by (I-566). Keyed by the
 * roster's own type, so a rank added there without words here is a compile error.
 */
const SCALE_RANK_WORDS: { readonly [R in ScaleRank]: string } = {
  QS_TWO_POINT: strings.consequence_dialog_scale_rank_QS_TWO_POINT,
  GRID_SPACING: strings.consequence_dialog_scale_rank_GRID_SPACING,
  DIMENSION_RATIO: strings.consequence_dialog_scale_rank_DIMENSION_RATIO,
  FILE_UNITS: strings.consequence_dialog_scale_rank_FILE_UNITS,
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

export function ConsequenceSummary({ consequence, digest, measurementFaces }: ConsequenceSummaryProps): ReactNode {
  return (
    <>
      {consequence.pinning === undefined ? null : <Pinning pinning={consequence.pinning} />}
      {consequence.measurement === undefined ? null : <MeasurementArm measurement={consequence.measurement} faces={measurementFaces ?? null} />}
      <ConsequenceSubjects consequence={consequence} faces={measurementFaces ?? null} />
      <ConsequenceEffects effects={consequence.effects} />
      <ConsequenceDetails actType={consequence.actType} digest={digest} subjects={consequence.subjects} calibrations={calibrationKeysOf(consequence)} />
    </>
  );
}

/** A catalogue value in a QS's words: `pile_cap` → "Pile cap", `pcc.blinding` → "Blinding" (the chest's reading). */
function catalogueWords(value: string): string {
  return humaniseEnum(value.slice(value.lastIndexOf(".") + 1));
}

/** A basis the glyph table names, or null for a value it does not — which is said in words instead. */
function basisOf(value: string): Basis | null {
  return value in BASIS_GLYPHS ? (value as Basis) : null;
}

/**
 * The MEASUREMENT arm's payload, as a QS reads a hand measurement before recording it (s-measure
 * I-373, § 2.5): the condition as applied — its class and kinds, each reading with its basis and
 * source — then, per kind, the figure the gate's own evaluation would publish with its unit, basis,
 * coverage and the gate's formula with its bound variables (I-384); the scale it stands on; and the
 * notes a demoted point, a scan or an edit owe. The payload is what the digest binds, so what is
 * shown here is what is confirmed.
 */
function MeasurementArm({ measurement, faces }: { measurement: ConsequenceMeasurement; faces: MeasurementFaces | null }): ReactNode {
  const figure = useFigure();
  const { recipe } = measurement;
  const kinds = recipe.kinds.map((entry) => catalogueWords(entry.kind)).join(", ");
  return (
    <section className="cx-consequence-measurement" data-object-key={measurement.objectKey} data-basis={measurement.basis}>
      <p className="cx-consequence-measurement-condition" data-testid={TESTIDS.consequence.measurementCondition} data-condition={recipe.conditionId ?? ""}>
        <span className="cx-consequence-measurement-name">{recipe.conditionName}</span>
        <span className="cx-consequence-measurement-meta">{`${catalogueWords(recipe.elementClass)} · ${kinds}`}</span>
      </p>
      {recipe.readings.length === 0 ? null : (
        <ul className="cx-consequence-measurement-readings" aria-label={strings.consequence_dialog_measurement_readings}>
          {recipe.readings.map((reading) => {
            const basis = basisOf(reading.basis);
            return (
              <li
                key={reading.attribute}
                className="cx-consequence-measurement-reading"
                data-testid={TESTIDS.consequence.measurementReading}
                data-attribute={reading.attribute}
                data-value={reading.valueAsWritten}
                data-unit={reading.unitAsWritten}
                data-basis={reading.basis}
                data-source={reading.sourceKey ?? ""}
              >
                <span className="cx-consequence-measurement-attribute">{variableWords(reading.attribute)}</span>
                <span className="cx-consequence-figure">
                  {figure(reading.valueAsWritten)}
                  <UnitBadge unit={reading.unitAsWritten} />
                </span>
                {basis === null ? <span>{humaniseEnum(reading.basis)}</span> : <BasisChip basis={basis} />}
              </li>
            );
          })}
        </ul>
      )}
      <ul className="cx-consequence-measurement-quantities">
        {(measurement.offered ?? []).map((offered) => (
          <OfferedRow key={offered.kind} offered={offered} faces={faces} />
        ))}
      </ul>
      <p className="cx-consequence-measurement-scale" data-factor-x={measurement.factorX} data-factor-y={measurement.factorY}>
        <span className="cx-consequence-effects-label">{strings.consequence_dialog_measurement_scale}</span>
        <span className="cx-consequence-figure">
          {fill(strings.consequence_dialog_measurement_scale_factors, { x: figure(measurement.factorX), y: figure(measurement.factorY) })}
        </span>
        <IdChip value={measurement.calibrationKey} />
      </p>
      {measurement.demoted === 0 ? null : (
        <p className="cx-consequence-measurement-note" data-note="demoted">
          {fill(strings.consequence_dialog_measurement_demoted, { count: figure(String(measurement.demoted)) })}
        </p>
      )}
      {measurement.basis === "INTERPRETED" ? (
        <p className="cx-consequence-measurement-note" data-note="interpreted">
          {strings.consequence_dialog_measurement_interpreted}
        </p>
      ) : null}
      {measurement.replaces === null ? null : (
        <p className="cx-consequence-measurement-note" data-note="replaces">
          {fill(strings.consequence_dialog_measurement_replaces, { previous: measurement.replaces })}
        </p>
      )}
    </section>
  );
}

/**
 * One kind of the measurement as the gate answers it (I-384): the figure it would publish, with the
 * gate's own formula; a queued kind with its cause; or a kind no pairing offers, said as such.
 */
function OfferedRow({ offered, faces }: { offered: OfferedFigure; faces: MeasurementFaces | null }): ReactNode {
  const figure = useFigure();
  const kind = catalogueWords(offered.kind);
  switch (offered.arm) {
    case "published": {
      const basis = basisOf(offered.quantityBasis);
      return (
        <li
          className="cx-consequence-measurement-quantity"
          data-testid={TESTIDS.consequence.measurementQuantity}
          data-kind={offered.kind}
          data-arm={offered.arm}
          data-value={offered.value ?? ""}
          data-unit={offered.unit}
          data-basis={offered.quantityBasis}
          data-coverage={offered.coverage}
        >
          <span className="cx-consequence-measurement-kind">{kind}</span>
          <span className="cx-consequence-figure">
            {offered.value === null ? strings.consequence_dialog_none : faces === null ? figure(offered.value) : faces.quantity(offered.value, offered.kind)}
            <UnitBadge unit={offered.unit} />
          </span>
          {basis === null ? <span>{humaniseEnum(offered.quantityBasis)}</span> : <BasisChip basis={basis} />}
          <span className="cx-consequence-measurement-coverage">{humaniseEnum(offered.coverage)}</span>
          <FormulaWords formula={offered.formula} faces={faces} />
        </li>
      );
    }
    case "queued":
      return (
        <li className="cx-consequence-measurement-quantity" data-testid={TESTIDS.consequence.measurementQuantity} data-kind={offered.kind} data-arm={offered.arm}>
          <span className="cx-consequence-measurement-kind">{kind}</span>
          <span>{fill(strings.consequence_dialog_measurement_queued, { cause: humaniseEnum(offered.cause) })}</span>
        </li>
      );
    case "not-offered":
      return (
        <li className="cx-consequence-measurement-quantity" data-testid={TESTIDS.consequence.measurementQuantity} data-kind={offered.kind} data-arm={offered.arm}>
          <span className="cx-consequence-measurement-kind">{kind}</span>
          <span>{strings.consequence_dialog_measurement_not_offered}</span>
        </li>
      );
    default:
      return unoffered(offered);
  }
}

/**
 * The words each variable of a hand method is read by (I-662): `t` is "Thickness", `A` is
 * "Area". A variable the table does not hold is said by its own name, as the formula spells it.
 */
const VARIABLE_WORDS: Readonly<Record<string, string>> = {
  count: strings.consequence_dialog_variable_count,
  A: strings.consequence_dialog_variable_A,
  openings: strings.consequence_dialog_variable_openings,
  junctions: strings.consequence_dialog_variable_junctions,
  t: strings.consequence_dialog_variable_t,
  threshold: strings.consequence_dialog_variable_threshold,
};

/** A formula variable, or a reading a condition states, by its name in words — "Thickness" for `t`. */
export function variableWords(name: string): string {
  return VARIABLE_WORDS[name] ?? name;
}

/**
 * The gate's formula as a QS checks it (I-662): the template, then each variable by its name
 * in words and its reading at the places a QS reads it — "Area 328.838 m²" — the exact reading kept
 * on the element. A sentence the faces cannot take apart, or a card with no faces, shows the
 * sentence verbatim (L-QTY-03: it is the line's own formula, never re-spelled into something else).
 */
function FormulaWords({ formula, faces }: { formula: string; faces: MeasurementFaces | null }): ReactNode {
  const parts = faces?.formula(formula) ?? null;
  if (faces === null || parts === null) {
    return (
      <span className="cx-consequence-measurement-formula" data-technical="">
        <span className="cx-consequence-effects-label">{strings.consequence_dialog_measurement_formula}</span> {formula}
      </span>
    );
  }
  return (
    <span className="cx-consequence-measurement-formula" data-formula={formula}>
      <span className="cx-consequence-measurement-template" data-technical="">
        <span className="cx-consequence-effects-label">{strings.consequence_dialog_measurement_formula}</span> {parts.template}
      </span>
      <span className="cx-consequence-measurement-variables" aria-label={strings.consequence_dialog_measurement_variables}>
        {parts.variables.map((variable) => {
          if (variable.state === "omitted") {
            return (
              <span key={variable.name} className="cx-consequence-measurement-variable" data-testid={TESTIDS.consequence.measurementVariable} data-name={variable.name} data-omitted={variable.code}>
                {variableWords(variable.name)} {strings.consequence_dialog_measurement_variable_omitted}
              </span>
            );
          }
          const read = faces.variable(variable.value, variable.unit);
          return (
            <span key={variable.name} className="cx-consequence-measurement-variable" data-testid={TESTIDS.consequence.measurementVariable} data-name={variable.name} data-value={variable.value} data-unit={variable.unit}>
              {variableWords(variable.name)}{" "}
              <span className="cx-consequence-figure">
                {read.value}
                <UnitBadge unit={read.unit} />
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** An arm of `OfferedFigure` with no case above fails to compile here. */
function unoffered(offered: never): never {
  throw new Error(`a kind was offered as ${JSON.stringify(offered)}, which the card has no rendering for (I-384)`);
}

/**
 * I-561: what a pin records, in the words the set screen uses — the set, the revision of it this
 * pin becomes, how many drawings it cites, and what happens to the revision standing now. The content
 * addresses the pin binds stand in Details, never here.
 */
function Pinning({ pinning }: { pinning: ConsequencePinning }): ReactNode {
  const figure = useFigure();
  const revision = figure(String(pinning.revision));
  const records =
    pinning.drawings === 1
      ? fill(strings.consequence_dialog_pin_records_one, { set: pinning.setName, revision })
      : fill(strings.consequence_dialog_pin_records, { set: pinning.setName, revision, count: figure(String(pinning.drawings)) });
  return (
    <div className="cx-consequence-pinning" data-testid={TESTIDS.consequence.pinning} data-revision={pinning.revision} data-count={pinning.drawings}>
      <p className="cx-consequence-pinning-records">{records}</p>
      <p className="cx-consequence-pinning-standing">
        {pinning.standing === null
          ? strings.consequence_dialog_pin_first
          : fill(strings.consequence_dialog_pin_standing, { revision: figure(String(pinning.standing)) })}
      </p>
    </div>
  );
}

/**
 * I-560: the words a discipline is read in, keyed by the roster's own type so a discipline added
 * there without words here is a compile error (R-UI-082, as ACT_WORDS is).
 */
const DISCIPLINE_WORDS: { readonly [D in Discipline]: string } = {
  STRUCTURAL: strings.consequence_dialog_discipline_structural,
  ARCHITECTURAL: strings.consequence_dialog_discipline_architectural,
  MEP: strings.consequence_dialog_discipline_mep,
  CIVIL: strings.consequence_dialog_discipline_civil,
  OTHER: strings.consequence_dialog_discipline_other,
};

/** The sentences each vocabulary counts a change in — total over the union, so a vocabulary added without them is a compile error. */
const CHANGE_WORDS: { readonly [K in ConsequenceHeld["kind"]]: { readonly change: string; readonly same: string; readonly members: string } } = {
  DISCIPLINE: {
    change: strings.consequence_dialog_change_sheets,
    same: strings.consequence_dialog_same_sheets,
    members: strings.consequence_dialog_members_sheets,
  },
  DRAWING_REVISION: {
    change: strings.consequence_dialog_change_drawings,
    same: strings.consequence_dialog_same_drawings,
    members: strings.consequence_dialog_members_drawings,
  },
  LEVEL_POSITION: {
    change: strings.consequence_dialog_change_levels,
    same: strings.consequence_dialog_same_levels,
    members: strings.consequence_dialog_members_levels,
  },
  LEVEL_CARRIED: {
    change: strings.consequence_dialog_change_objects,
    same: strings.consequence_dialog_same_objects,
    members: strings.consequence_dialog_members_objects,
  },
};

/** One side of a held change in words: never the enum, never the content address. */
function heldSaid(held: ConsequenceHeld, side: "before" | "after", figure: (value: string) => string): string {
  switch (held.kind) {
    case "DISCIPLINE": {
      const value = held[side];
      return value === null ? strings.consequence_dialog_discipline_none : wordsFor(DISCIPLINE_WORDS, value);
    }
    case "DRAWING_REVISION": {
      const value = held[side];
      return value === null ? strings.consequence_dialog_revision_none : fill(strings.consequence_dialog_revision, { ordinal: figure(String(value)) });
    }
    case "LEVEL_POSITION": {
      // An ordinal is a signed integer (a basement stands below 0), said whole rather than grouped.
      const value = held[side];
      return value === null ? strings.consequence_dialog_level_position_none : fill(strings.consequence_dialog_level_position, { n: String(value) });
    }
    case "LEVEL_CARRIED": {
      const value = held[side];
      return value === null ? strings.consequence_dialog_level_carried_none : fill(strings.consequence_dialog_level_carried, { level: value });
    }
    default:
      return unsaid(held);
  }
}

/** A vocabulary added to `ConsequenceHeld` without a case above fails to compile here. */
function unsaid(held: never): never {
  throw new Error(`a subject's values arrived in ${JSON.stringify(held)}, which this dialog has no words for (I-560)`);
}

/**
 * What the subject list renders, in the order the seam answered: a subject on its own, or the
 * subjects making one and the same change, counted together at the place the first of them stood
 * (I-560). Only subjects that say their vocabulary are counted together — a subject with a
 * standing, or whose values are already words, keeps its own row, as every act before this one did.
 */
type SubjectEntry =
  | { readonly shape: "one"; readonly subject: ConsequenceSubject }
  | { readonly shape: "change"; readonly held: ConsequenceHeld; readonly subjects: readonly ConsequenceSubject[] };

function subjectEntriesOf(subjects: readonly ConsequenceSubject[]): SubjectEntry[] {
  const entries: (SubjectEntry | { readonly shape: "change"; readonly held: ConsequenceHeld; readonly subjects: ConsequenceSubject[] })[] = [];
  const changes = new Map<string, ConsequenceSubject[]>();
  for (const subject of subjects) {
    const held = subject.held;
    if (held === undefined || subject.standing !== undefined) {
      entries.push({ shape: "one", subject });
      continue;
    }
    const key = JSON.stringify([held.kind, held.before, held.after]);
    const standing = changes.get(key);
    if (standing !== undefined) {
      standing.push(subject);
      continue;
    }
    const members = [subject];
    changes.set(key, members);
    entries.push({ shape: "change", held, subjects: members });
  }
  // A change only one subject makes reads as that subject's own row, its columns in words.
  return entries.map((entry): SubjectEntry => {
    const only = entry.shape === "change" && entry.subjects.length === 1 ? entry.subjects[0] : undefined;
    return only === undefined ? entry : { shape: "one", subject: only };
  });
}

/**
 * The subjects making one change, as a reader counts them — "29 sheets from Unassigned to
 * Structural" — with each subject one press away, by the name it is recognised by. Each member keeps
 * its `consequence-subject-row` and `data-subject`, so what the act moves is still one row per subject.
 */
function ChangeGroup({ held, subjects }: { held: ConsequenceHeld; subjects: readonly ConsequenceSubject[] }): ReactNode {
  const figure = useFigure();
  const words = CHANGE_WORDS[held.kind];
  const count = figure(String(subjects.length));
  const before = heldSaid(held, "before", figure);
  const after = heldSaid(held, "after", figure);
  const said = before === after ? fill(words.same, { count, after }) : fill(words.change, { count, before, after });
  return (
    <li
      className="cx-consequence-subject cx-consequence-change"
      data-testid={TESTIDS.consequence.changeGroup}
      data-held={held.kind}
      data-before={held.before ?? ""}
      data-after={held.after ?? ""}
      data-count={subjects.length}
    >
      <p className="cx-consequence-change-said">{said}</p>
      <details className="cx-consequence-ids">
        <summary className="cx-consequence-disclosure cx-reticle">{fill(words.members, { count })}</summary>
        <ul className="cx-consequence-members">
          {subjects.map((subject) => (
            <li key={subject.subjectId} className="cx-consequence-member" data-testid={TESTIDS.consequence.subjectRow} data-subject={subject.subjectId}>
              <span className="cx-consequence-subject-label">{subject.subjectLabel ?? subject.subjectId}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

/**
 * I-45: the consequence rendering is a total map. L-ACT-02 makes an act type without a rendering a
 * compile error, and this component is where acts render — so the subjects render by an exhaustive
 * switch over the Consequence's closed rendering arms, each named by the Consequence itself and never
 * defaulted here. An arm added to `ConsequenceRendering` (L-ACT-02's offered groups, R-UI-023) owes
 * its case below, or `unrendered` fails to compile.
 */
function ConsequenceSubjects({ consequence, faces }: { consequence: Consequence; faces: MeasurementFaces | null }): ReactNode {
  const arm: ConsequenceRendering = consequence.rendering;
  switch (arm) {
    // A hand measurement's subjects are the register row it adds and, on an edit, the one it strikes
    // (s-measure I-373), said as what the act adds to the bill (I-663).
    case "MEASUREMENT":
      if (consequence.measurement !== undefined) return <MeasurementSubjects consequence={consequence} measurement={consequence.measurement} faces={faces} />;
      return <SubjectList subjects={consequence.subjects} />;
    case "SUBJECTS":
      return <SubjectList subjects={consequence.subjects} />;
    default:
      return unrendered(arm);
  }
}

/** The subjects, one row each or counted together where they make one change (I-560). */
function SubjectList({ subjects }: { subjects: readonly ConsequenceSubject[] }): ReactNode {
  return (
    <ul className="cx-consequence-subjects">
      {subjectEntriesOf(subjects).map((entry) =>
        entry.shape === "one" ? (
          <SubjectRow key={entry.subject.subjectId} subject={entry.subject} />
        ) : (
          <ChangeGroup key={`change:${entry.subjects[0]?.subjectId ?? ""}`} held={entry.held} subjects={entry.subjects} />
        ),
      )}
    </ul>
  );
}

/**
 * A hand measurement's subjects as what the act does to the bill (I-663): the register row it
 * adds, said as the lines it adds — "Adds 1 line: GF slab blinding 23.195 m³" — and, on an edit, the
 * measurement it strikes. The subject ids stay on the rows (what the act moves is still one row per
 * subject); the register's own words for a row, REGISTERED and REPUDIATED, stand in Details.
 */
function MeasurementSubjects({ consequence, measurement, faces }: { consequence: Consequence; measurement: ConsequenceMeasurement; faces: MeasurementFaces | null }): ReactNode {
  const figure = useFigure();
  const published = (measurement.offered ?? []).filter((offered): offered is Extract<OfferedFigure, { arm: "published" }> => offered.arm === "published" && offered.value !== null);
  const level = faces?.level(measurement.level) ?? null;
  const adds = published.length === 0 ? strings.consequence_dialog_measurement_adds_none : published.length === 1 ? strings.consequence_dialog_measurement_adds_one : fill(strings.consequence_dialog_measurement_adds, { count: figure(String(published.length)) });
  return (
    <ul className="cx-consequence-subjects">
      {consequence.subjects.map((subject) =>
        subject.subjectId === measurement.objectKey ? (
          <li key={subject.subjectId} className="cx-consequence-subject cx-consequence-adds" data-testid={TESTIDS.consequence.subjectRow} data-subject={subject.subjectId} data-lines={published.length}>
            <p className="cx-consequence-adds-said" data-testid={TESTIDS.consequence.measurementAdds}>
              <span>{adds}</span>
              {published.map((offered) => {
                const description = `${catalogueWords(measurement.recipe.elementClass)} ${catalogueWords(offered.kind)}`.toLowerCase();
                const value = offered.value as string;
                return (
                  <span key={offered.kind} className="cx-consequence-adds-line" data-kind={offered.kind} data-value={value}>
                    {level === null ? description : `${level} ${description}`}{" "}
                    <span className="cx-consequence-figure">
                      {faces === null ? figure(value) : faces.quantity(value, offered.kind)}
                      <UnitBadge unit={offered.unit} />
                    </span>
                  </span>
                );
              })}
            </p>
          </li>
        ) : (
          <li key={subject.subjectId} className="cx-consequence-subject" data-testid={TESTIDS.consequence.subjectRow} data-subject={subject.subjectId}>
            <p className="cx-consequence-adds-said">{fill(strings.consequence_dialog_measurement_strikes, { previous: subject.subjectLabel ?? subject.subjectId })}</p>
          </li>
        ),
      )}
    </ul>
  );
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
  if (subject.scale !== undefined) return <ScaleSubjectRow subject={subject} scale={subject.scale} />;
  const standing = subject.standing;
  const held = subject.held;
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
          {standing !== undefined ? (
            <Standing held={standing.before} variant="before" />
          ) : held !== undefined ? (
            <HeldWords held={held} side="before" />
          ) : (
            <RoleList roles={subject.before} variant="before" />
          )}
        </div>
        <div className="cx-consequence-column">
          <span className="cx-consequence-column-label">{strings.consequence_dialog_after_label}</span>
          {standing !== undefined ? (
            <Standing held={standing.after} variant="after" />
          ) : held !== undefined ? (
            <HeldWords held={held} side="after" />
          ) : (
            <RoleList roles={subject.after} variant="after" />
          )}
        </div>
      </div>
      {standing === undefined ? null : <Recorded standing={standing} />}
    </li>
  );
}

/** One side of a subject's values in its vocabulary's words (I-560); the values themselves stand in Details. */
function HeldWords({ held, side }: { held: ConsequenceHeld; side: "before" | "after" }): ReactNode {
  const figure = useFigure();
  return (
    <span className="cx-consequence-held" data-column={side} data-value={held[side] ?? ""}>
      {heldSaid(held, side, figure)}
    </span>
  );
}

/**
 * A view whose scale an affirmation moves, said as a QS reads a scale (I-566): the rank it
 * stands on and what one drawing unit is — "Dimension ratio · 1 drawing unit is 1 mm" — before and
 * after. The calibration keys the act moves are identifiers, and live behind Details with the digest.
 */
function ScaleSubjectRow({ subject, scale }: { subject: ConsequenceSubject; scale: NonNullable<ConsequenceSubject["scale"]> }): ReactNode {
  return (
    <li
      className="cx-consequence-subject"
      data-testid={TESTIDS.consequence.subjectRow}
      data-subject={subject.subjectId}
      data-scale-before={scale.before?.rank ?? ""}
      data-scale-after={scale.after.rank}
    >
      <p className="cx-consequence-subject-label">{subject.subjectLabel ?? subject.subjectId}</p>
      <div className="cx-consequence-roles">
        <div className="cx-consequence-column">
          <span className="cx-consequence-column-label">{strings.consequence_dialog_before_label}</span>
          {scale.before === null ? <span className="cx-consequence-none">{strings.consequence_dialog_scale_none}</span> : <ScaleWords held={scale.before} variant="before" />}
        </div>
        <div className="cx-consequence-column">
          <span className="cx-consequence-column-label">{strings.consequence_dialog_after_label}</span>
          <ScaleWords held={scale.after} variant="after" />
        </div>
      </div>
    </li>
  );
}

/** One scale in words: its rank, then the millimetres one drawing unit is — once, or per axis where X and Y differ. */
function ScaleWords({ held, variant }: { held: ScaleOfSubject; variant: "before" | "after" }): ReactNode {
  const figure = useFigure();
  const one = held.millimetresX === held.millimetresY;
  return (
    <span className="cx-consequence-standing" data-column={variant} data-rank={held.rank} data-factor-x={held.factorX} data-factor-y={held.factorY}>
      <span className="cx-consequence-standing-word">{wordsFor(SCALE_RANK_WORDS, held.rank)}</span>
      <span className="cx-consequence-standing-readings">
        {strings.consequence_dialog_scale_per_unit}{" "}
        {one ? (
          <span className="cx-consequence-figure">
            {figure(held.millimetresX)}
            <UnitBadge unit="mm" />
          </span>
        ) : (
          <>
            <span className="cx-consequence-figure">
              {strings.consequence_dialog_scale_axis_x} {figure(held.millimetresX)}
              <UnitBadge unit="mm" />
            </span>{" "}
            <span className="cx-consequence-figure">
              {strings.consequence_dialog_scale_axis_y} {figure(held.millimetresY)}
              <UnitBadge unit="mm" />
            </span>
          </>
        )}
      </span>
    </span>
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
/** The calibration keys a scale affirmation moves its views to, for Details (I-566); empty for every other act. */
function calibrationKeysOf(consequence: Consequence): readonly string[] {
  return consequence.subjects.flatMap((subject) => (subject.scale === undefined ? [] : subject.after));
}

function ConsequenceDetails({ actType, digest, subjects, calibrations }: { actType: string; digest: string; subjects: readonly ConsequenceSubject[]; calibrations: readonly string[] }): ReactNode {
  // I-560: a value said in words on the face — a drawing's content sha-256, a discipline enum —
  // is still what the act records, so it stands here whole, subject by subject.
  const recorded = subjects.filter((subject) => subject.held !== undefined);
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
        {recorded.length === 0 ? null : (
          <>
            <dt className="cx-consequence-effects-label">{strings.consequence_dialog_details_values}</dt>
            <dd className="cx-consequence-technical-value" data-technical="">
              <ul className="cx-consequence-values">
                {recorded.map((subject) => (
                  <li key={subject.subjectId} className="cx-consequence-value" data-subject={subject.subjectId}>
                    {`${subject.subjectLabel ?? subject.subjectId}: ${subject.before.join(" ") || strings.consequence_dialog_none} → ${subject.after.join(" ") || strings.consequence_dialog_none}`}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
        {calibrations.length === 0 ? null : (
          <>
            <dt className="cx-consequence-effects-label">{strings.consequence_dialog_details_calibrations}</dt>
            <dd className="cx-consequence-technical-value" data-technical="">
              {calibrations.join(" ")}
            </dd>
          </>
        )}
      </dl>
    </details>
  );
}
