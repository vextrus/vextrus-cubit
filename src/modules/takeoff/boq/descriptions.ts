// The draft's item descriptions, asked once per (class · kind) group (L-BD-01, L-AI-02, R-TO-053).
//
// WHAT IS ASKED IS READ OFF THE PUBLISHED LINES AND NOTHING ELSE. The group's class, kind, unit,
// storeys and bases are the register's own; what the drawings STATE about its members are the
// selecting attributes the rails carried onto the line as written (`selectors`, L-MEA-06), and the
// keys those attributes were read from are what an answer cites (L-AI-02). Nothing here re-measures,
// re-reads a drawing or opens the register a second time.
//
// A GROUP WITH NOTHING TO SELECT IS NEVER ASKED. Where the closed catalogue holds one description
// for the pair there is no selection to make, so no call is made and the draft keeps the plain
// description the emission has always written. Where it holds two or more — brickwork at a nominal
// thickness, a foundation pit in a depth band — one call is made and its answer is HELD: a
// classification stands beside the draft until the draft is issued (L-AI-02's third arm).
//
// ABSTENTION IS THE CALLER'S. A refusal — no recorded answer for this state, an unreadable or
// uncited answer — is caught HERE and nowhere deeper: the plain description stands, the draft reads
// on, and the refusal is a fact about the model rather than a fault of the draft (L-AI-02, ARCH-03).
import { candidateItemsFor } from "@/core/catalogue/item-descriptions";
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { sourceKeyResolver, type ModelCallContext } from "@/core/model";
import { DEFAULTED, INTERPRETED, groupKeyOf, type GroupDescription, type GroupDescriptions } from "./description-basis";
import { proposeLineDescription, type BoqAttributeState, type BoqDescriptionPort, type BoqDescriptionState } from "./description-question";
import { plinthBoundaryOf, resolveBill, type StackLevel } from "./resolver";

/**
 * The basis vocabulary, the group key and the shape a reading takes are the LEAF's beside this file
 * (`./description-basis`), and are re-published here so a caller holding the asker reads one
 * spelling of both (B-17): the screen may hold them without pulling this file's model seam — and
 * the store behind it — into the browser (ARCH-01, AS-01).
 */
export { DEFAULTED, INTERPRETED, groupKeyOf } from "./description-basis";
export type { DescriptionBasis, GroupDescription, GroupDescriptions } from "./description-basis";

/** One published line, as this file reads one: the register's own row, and nothing derived. */
export type DescribableLine = {
  readonly class: ElementType;
  readonly kind: Kind;
  readonly unit: string;
  readonly levelId: string | null;
  readonly quantityBasis: string;
  readonly selectionBasis: string;
  readonly drawingId: string;
  /** What the drawings state that SELECTS this line's item, as the rail carried it (L-MEA-06). */
  readonly selectors: Readonly<Record<string, unknown>>;
};

/** One question this draft would ask: the group it is about, its state, and the artifact it cites against. */
export type GroupAsk = {
  readonly key: string;
  readonly state: BoqDescriptionState;
  readonly artifactDigest: string;
};

/**
 * Every group of a campaign's published lines that has a description to CHOOSE, with the state its
 * question is asked over (test contract: `groupAsksOf`).
 *
 * The exemplar is the group's first published line: one group is one item of the bill, so the
 * attributes put to the question are one member's, the way a bill quotes one description for a
 * group of walls. A group whose exemplar states nothing and cites nothing is not asked — an answer
 * that could cite no source is UNSOURCED by construction (L-AI-02).
 */
export function groupAsksOf(lines: readonly DescribableLine[], levels: readonly StackLevel[], digests: ReadonlyMap<string, string>): GroupAsk[] {
  const boundary = plinthBoundaryOf(levels);
  const byLevel = new Map(levels.map((level) => [level.levelId, level]));
  const grouped = new Map<string, DescribableLine[]>();
  for (const line of lines) {
    const key = groupKeyOf(line.class, line.kind);
    const held = grouped.get(key);
    if (held === undefined) grouped.set(key, [line]);
    else held.push(line);
  }

  const asks: GroupAsk[] = [];
  for (const [key, held] of grouped) {
    const exemplar = held[0];
    if (exemplar === undefined) continue;
    const candidates = candidateItemsFor(exemplar.class, exemplar.kind);
    // One candidate is a selection with nothing to select (docs: a choice needs options a reader
    // could tell apart), so the group is answered by code and no token is spent on it.
    if (candidates.length < 2) continue;
    const attributes = attributesOf(exemplar.selectors);
    const keys = keysOf(exemplar.selectors);
    const digest = digests.get(exemplar.drawingId);
    if (attributes.length === 0 || keys.length === 0 || digest === undefined) continue;
    const resolution = resolveBill({ class: exemplar.class, kind: exemplar.kind, levelOrdinal: byLevel.get(exemplar.levelId ?? "")?.ordinal ?? null }, boundary);
    const state: BoqDescriptionState = {
      line: {
        class: exemplar.class,
        kind: exemplar.kind,
        unit: exemplar.unit,
        levels: levelLabelsOf(held, byLevel),
        bill: resolution.bill,
        decidedBy: `${resolution.decidedBy.row}:${resolution.decidedBy.key}`,
        quantityBasis: exemplar.quantityBasis,
        selectionBasis: exemplar.selectionBasis,
      },
      attributes,
      candidates,
      keys,
    };
    asks.push({ key, state, artifactDigest: digest });
  }
  return asks;
}

/**
 * What a model proposes each group is billed under (test contract: `describeGroups`).
 *
 * One call per group, in the groups' own order, each one HELD as a proposal: what comes back is
 * carried beside the draft, never written into a line, a register row or an act (L-AI-03). A group
 * whose answer is the no-match outcome carries the DEFAULTED basis with its call id beside it — the
 * call was made and answered, and the calibration line reads it as awaiting a judgment nobody can
 * pass on an abstention.
 */
export async function describeGroups(ctx: ModelCallContext, asks: readonly GroupAsk[], port?: BoqDescriptionPort): Promise<GroupDescriptions> {
  const described = new Map<string, GroupDescription>();
  for (const ask of asks) {
    try {
      const proposal = await proposeLineDescription(ctx, { state: ask.state, artifact: sourceKeyResolver(ask.artifactDigest, ask.state.keys) }, port);
      const item = proposal.payload.item;
      described.set(ask.key, Object.freeze({ text: item?.text ?? null, basis: item === null ? DEFAULTED : INTERPRETED, callId: proposal.callId }));
    } catch (failure) {
      // A model that would not answer is an answer about the model, not about the draft: anything
      // that is not a refusal is a fault and travels on untouched (ARCH-03, B-21).
      if (refusalCodeOf(failure) === null) throw failure;
    }
  }
  return described;
}

/** What the drawings state about the exemplar, as the rail carried it — name, value and unit as written. */
function attributesOf(selectors: Readonly<Record<string, unknown>>): BoqAttributeState[] {
  const attributes: BoqAttributeState[] = [];
  for (const [name, measure] of Object.entries(selectors)) {
    if (measure === null || typeof measure !== "object") continue;
    const { value, unit } = measure as { value?: unknown; unit?: unknown };
    if (typeof value !== "string" || typeof unit !== "string") continue;
    attributes.push({ name, valueAsWritten: value, unitAsWritten: unit });
  }
  return attributes;
}

/** The source keys those attributes were read from, said once each, in the selectors' own order. */
function keysOf(selectors: Readonly<Record<string, unknown>>): string[] {
  const keys: string[] = [];
  for (const measure of Object.values(selectors)) {
    if (measure === null || typeof measure !== "object") continue;
    const source = (measure as { source?: unknown }).source;
    if (typeof source !== "string" || source === "" || keys.includes(source)) continue;
    keys.push(source);
  }
  return keys;
}

/** The storeys a group stands on, by label, in ordinal order — never a level id (L-QTY-03). */
function levelLabelsOf(held: readonly DescribableLine[], byLevel: ReadonlyMap<string, StackLevel>): string[] {
  const standing: StackLevel[] = [];
  for (const line of held) {
    const level = byLevel.get(line.levelId ?? "");
    if (level !== undefined && !standing.includes(level)) standing.push(level);
  }
  return standing.sort((one, other) => one.ordinal - other.ordinal).map((level) => level.label);
}
