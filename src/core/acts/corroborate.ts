// CORROBORATE (R-TO-051: "every human change is an act adding a competing observation with declared
// precedence; disagreements suspend and show as such; nothing overwrites"), rendered as L-ACT-02's
// pair.
//
// One act over one object and one attribute: a reading that does not name the attribute it is about
// is not a reading, and a reading about several attributes at once is a bulk this leaf does not offer.
// The commit APPENDS — one `register_observations` row at basis ENTERED, because a person typed it —
// and touches no reading that stood before (L-ACT-01).
//
// The standing the reading would produce is computed rather than guessed: the same canon the append
// carries the reading through canonicalises it here, and the same derivation the register reads a
// standing by is run over the readings plus this one (B-17).
import type { TenantTx } from "../db";
import { REFUSALS } from "../errors";
import { refusal } from "../faults/refusal-marker";
import {
  appendObservationIn,
  isRepudiatedIn,
  observationsIn,
  readingAsAppended,
  readsAsANumber,
  registerObjectIn,
  registerScopeIn,
  standingOf,
  type RegisterScope,
  type StandingOfAttribute,
} from "../register/store";
import type { Consequence, ConsequenceSubject } from "./consequence";
import { actChangesNothing } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const CORROBORATE = "CORROBORATE" as const;

/** A reading a person typed is ENTERED, whatever they read it off (L-REG-01's basis roster). */
const ENTERED = "ENTERED";

/** The code an unreadable reading is answered with, off the closed taxonomy rather than spelled (Q-07). */
const READING_NOT_NUMERIC = REFUSALS.READING_NOT_NUMERIC.code;

/** The act's input: one project, one object, one attribute, and the reading as it was written. */
export type CorroborateInput = {
  readonly type: typeof CORROBORATE;
  readonly projectId: string;
  readonly objectKey: string;
  readonly attribute: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly precedence: number;
  readonly sourceKey: string;
};

/** What the act would do, derived from the state this transaction read (L-ACT-02). */
type Derived = {
  readonly scope: RegisterScope;
  readonly before: StandingOfAttribute;
  readonly after: StandingOfAttribute;
};

/**
 * How a standing reads on the dialog: the state word, and the value that stands where one does. A
 * SUSPENDED attribute has no value at all — saying one beside the word would be the very claim the
 * suspension denies (L-REG-03) — so the word travels alone.
 */
function standingWords(standing: StandingOfAttribute): string[] {
  if (standing.canonicalValue === null || standing.canonicalUnit === null) return [standing.standing];
  return [standing.standing, standing.canonicalValue, standing.canonicalUnit];
}

/**
 * The act, applied to the state this transaction read.
 *
 * Three things make this act nothing at all, and each says so by name rather than writing a record of
 * nothing: a project with no campaign open has no register for a reading to be about, an object the
 * pinned revision does not hold is not an object, and an object a person has already struck is not
 * one either (I-173). A value that is no number is a different answer — the reading itself is
 * unreadable, which is the registered `READING_NOT_NUMERIC` a person can act on (ARCH-03).
 */
async function derive(ctx: ActorCtx, input: CorroborateInput, tx: TenantTx): Promise<Derived> {
  const held = await registerScopeIn(tx, ctx.tenantId, input.projectId);
  if (held === null) throw actChangesNothing(CORROBORATE, [input.objectKey]);

  if (!readsAsANumber(input.valueAsWritten)) {
    throw refusal(READING_NOT_NUMERIC, `"${input.valueAsWritten}" states no number, so there is no reading to record against ${input.attribute}`, {
      actType: CORROBORATE,
      objectKey: input.objectKey,
      attribute: input.attribute,
    });
  }

  const object = await registerObjectIn(tx, held, input.objectKey);
  if (object === undefined) throw actChangesNothing(CORROBORATE, [input.objectKey]);
  if (await isRepudiatedIn(tx, held, input.objectKey)) throw actChangesNothing(CORROBORATE, [input.objectKey]);

  const proposed = readingAsAppended(held, {
    objectKey: input.objectKey,
    attribute: input.attribute,
    valueAsWritten: input.valueAsWritten,
    unitAsWritten: input.unitAsWritten,
    basis: ENTERED,
    sourceKey: input.sourceKey,
    precedence: input.precedence,
    actId: null,
  });
  // The canon knows the unit or it does not, and a unit it cannot carry a reading through is a
  // refusal a person can act on rather than a fault (ARCH-03, L-FRM-06).
  if (!proposed.ok) {
    throw refusal(proposed.refusal, `the reading "${input.valueAsWritten} ${input.unitAsWritten}" could not be carried to its canonical unit`, {
      actType: CORROBORATE,
      objectKey: input.objectKey,
      attribute: input.attribute,
    });
  }

  const stood = await observationsIn(tx, held, input.objectKey, input.attribute);
  return { scope: held, before: standingOf(stood), after: standingOf([...stood, proposed.reading]) };
}

/** The one subject the act judges: the object the reading is about, before and after it stands. */
function subjectOf(input: CorroborateInput, derived: Derived): ConsequenceSubject {
  return {
    subjectId: input.objectKey,
    subjectLabel: input.attribute,
    before: standingWords(derived.before),
    after: standingWords(derived.after),
  };
}

export const corroborate: ActRendering<CorroborateInput> = {
  async preview(ctx: ActorCtx, input: CorroborateInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: CORROBORATE,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: [subjectOf(input, derived)],
    };
  },

  async commit(ctx: ActorCtx, input: CorroborateInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    const appended = await appendObservationIn(tx, derived.scope, {
      objectKey: input.objectKey,
      attribute: input.attribute,
      valueAsWritten: input.valueAsWritten,
      unitAsWritten: input.unitAsWritten,
      basis: ENTERED,
      sourceKey: input.sourceKey,
      precedence: input.precedence,
      actId: act.actId,
    });
    // `derive` already carried this very reading through the canon, so a refusal here would mean the
    // preview and the append read one reading two ways — which is a fault of this file, not an answer
    // anybody could act on (ARCH-03, B-17).
    if (!appended.appended) {
      throw new Error(`${CORROBORATE} previewed a reading the register then refused as ${appended.refusal} — the preview and the append disagree (L-ACT-02)`);
    }
  },
};
