// CORROBORATE (R-TO-051: "every human change is an act adding a competing observation with declared
// precedence; disagreements suspend and show as such; nothing overwrites"), rendered as L-ACT-02's
// pair.
//
// One act over one object and one attribute: a reading that does not name the attribute it is about
// is not a reading, and a reading about several attributes at once is a bulk this leaf does not offer.
// The commit APPENDS — one `register_observations` row at basis ENTERED, because a person typed it —
// and touches no reading that stood before (L-ACT-01). Where the reading restates what a scan was
// read as and leaves every reading of an interpreted outline agreed, the same commit writes that
// outline's queue-item resolution — the AGREED exit L-QTY-04 lets an interpreted line reach a bill by
// (s-takeoff I-685). A bulk act appends one such restatement per member through this same pair.
//
// The standing the reading would produce is computed rather than guessed: the same canon the append
// carries the reading through canonicalises it here, and the same derivation the register reads a
// standing by is run over the readings plus this one (B-17).
import type { TenantTx } from "../db";
import { REFUSALS } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { recordCorroborationOutcomeIn } from "../outline-corroboration/outcome";
import {
  appendObservationIn,
  awaitingItemsIn,
  everyReadingCorroborated,
  isRepudiatedIn,
  observationsOfObjectsIn,
  readingAsAppended,
  readsAsANumber,
  registerObjectIn,
  registerScopeIn,
  resolveQueueItemsIn,
  standingOf,
  type AwaitingItem,
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
  /**
   * The model proposal this reading was recorded beside, as the screen showed it, or absent where
   * none stood (L-AI-02: what the person then did is the labeled outcome the calibration line is
   * read over). It changes NOTHING about the act: the reading, its standing and its refusals are
   * the same whether or not a model ever spoke, and a call that is not this project's, not this
   * question's or that refused files nothing at all (`../outline-corroboration/outcome`).
   */
  readonly proposalCallId?: string;
};

/** What the act would do, derived from the state this transaction read (L-ACT-02). */
type Derived = {
  readonly scope: RegisterScope;
  readonly before: StandingOfAttribute;
  readonly after: StandingOfAttribute;
  /**
   * The interpreted outline's queue items this reading would resolve: every item of the object whose
   * readings would all stand corroborated with this one appended (s-takeoff I-685). Empty for an
   * object nothing interpreted, and for a reading that disagrees.
   */
  readonly resolving: readonly AwaitingItem[];
};

/** What a resolved item stands at after the act — the standing its exit is named for (L-QTY-04). */
const AGREED = "AGREED";

/**
 * How a standing reads on the dialog: the state word, the value that stands where one does, and one
 * line per reading on record. A SUSPENDED attribute has no value at all — saying one beside the word
 * would be the very claim the suspension denies (L-REG-03) — so the word travels without a value.
 *
 * The readings travel because a corroboration is an act even when it does not move the standing word:
 * corroborating an already-agreed value adds evidence (R-TO-051, "every human change is an act adding
 * a competing observation"), and the seam's `movesNothing` guard reads `before` against `after` — so
 * the reading appended has to show as the difference it is, or an act that in fact records something
 * would be refused as one that changes nothing (L-ACT-01).
 */
function standingWords(standing: StandingOfAttribute): string[] {
  const value = standing.canonicalValue === null || standing.canonicalUnit === null ? [] : [standing.canonicalValue, standing.canonicalUnit];
  const readings = [...standing.competing, ...standing.overruled].map((reading) => `${reading.basis} ${reading.valueAsWritten} ${reading.unitAsWritten}`);
  return [standing.standing, ...value, ...readings];
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

  // Every reading of the object, read once: the attribute this act speaks about, and the others an
  // interpreted item may name beside it (s-takeoff I-685).
  const readings = (await observationsOfObjectsIn(tx, held, [input.objectKey])).get(input.objectKey) ?? new Map();
  const stood = readings.get(input.attribute) ?? [];
  const after = standingOf([...stood, proposed.reading]);
  const standingAfter = (attribute: string): StandingOfAttribute => (attribute === input.attribute ? after : standingOf(readings.get(attribute) ?? []));

  // L-QTY-04's AGREED exit: an item this reading leaves with every interpreted reading corroborated
  // is resolved by this act, in its own transaction (L-ACT-01) — and one it does not is left queued,
  // so a reading that disagrees, or agrees one attribute of several, resolves nothing yet.
  const awaiting = await awaitingItemsIn(tx, held, input.objectKey);
  const resolving = awaiting.filter((item) => everyReadingCorroborated(item.readings, standingAfter, after));
  return { scope: held, before: standingOf(stood), after, resolving };
}

/**
 * The subjects the act judges: the object the reading is about, before and after it stands — and,
 * where the reading agrees an interpreted outline, each queue item it resolves, from the cause it was
 * deferred for to the AGREED exit it takes, so the person confirms the exit with the reading.
 */
function subjectsOf(input: CorroborateInput, derived: Derived): ConsequenceSubject[] {
  const reading: ConsequenceSubject = {
    subjectId: input.objectKey,
    subjectLabel: input.attribute,
    before: standingWords(derived.before),
    after: standingWords(derived.after),
  };
  const exits = derived.resolving.map((item) => ({ subjectId: item.queueItemId, subjectLabel: item.kind, before: [item.cause], after: [AGREED] }));
  return [reading, ...exits];
}

export const corroborate: ActRendering<CorroborateInput> = {
  async preview(ctx: ActorCtx, input: CorroborateInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: CORROBORATE,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: subjectsOf(input, derived),
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

    // The AGREED exit of every item the Consequence named, beside the reading and the act row or not
    // at all (L-ACT-01). The gate publishes nothing here: the campaign's next measure run finds the
    // item resolved and asks the readings again (s-takeoff I-685).
    await resolveQueueItemsIn(tx, derived.scope, derived.resolving, act.actId);

    // What this person did with the proposal that stood beside the object: corroborating an outline
    // the machine read as the member its mark names AFFIRMS what it said, and corroborating one it
    // read as something else OVERRULES it (L-AI-02). It lands in this transaction, with the act row,
    // or neither (L-ACT-01) — and where the machine could not tell, or never spoke, nothing is filed
    // and the act stands exactly as it stands today.
    if (input.proposalCallId !== undefined) {
      await recordCorroborationOutcomeIn(tx, {
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        callId: input.proposalCallId,
        act: CORROBORATE,
        actId: act.actId,
        actorUserId: ctx.userId,
      });
    }
  },
};
