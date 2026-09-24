/**
 * F-RCC6-BNBC's columns as the ties proofs read them (R6b, D-003; s-bbs I-656).
 *
 * Pure: it reads the fixture's own model and golden as data and opens no database, so every case
 * that uses it stays in the unit lane. Two things live here.
 *
 * 1. THE ORACLE. An independent count of a column's tie sets, N(D), and of its exact minimum over a
 *    joint depth interval — written in whole numbers of 1/240 mm, so every quotient BNBC's zones ask
 *    for (clear/6, two thirds of the clear, the half millimetre the counting rule allows) is an exact
 *    integer and nothing rounds. The minimum is found by visiting EVERY depth of the 1/40 mm lattice
 *    from max(D_lo, 450) up to h. Every place N can change lies on the 1/20 mm lattice for figures
 *    stated to a tenth of a millimetre (h − 6(k·s − ½), h − 1.5(k·s − ½), k·s − ½, h − 6M, h − 2M), so
 *    the 1/40 mm lattice visits every breakpoint AND a depth inside every open interval between two
 *    of them. It shares no code with the product: it is the arithmetic of W-28 re-stated, and a
 *    brute force where the product enumerates its breakpoints.
 *
 * 2. THE INPUT. Every column of the model as a rail input: one level per storey (FDN as a level, as
 *    J-000's stack stands), a placement and a variant per member stating its section, its main group
 *    and the two tie spacings its mark's schedule states, and — where asked — each column's top joint
 *    as the joint seam would answer it, off the framing a given set of beams stands for.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BNBC_MODEL,
  COLUMN_CLASS,
  REPO_ROOT,
  placement,
  railInput,
  reading,
  registerRow,
  variant,
  zone,
  levelStanding,
  type DetailingSetupShape,
  type JointReadingShape,
  type MethodPairShape,
  type PlacementSetupShape,
  type RailInputShape,
  type VariantSetupShape,
} from "./rebar-contract";

/* ------------------------------------------------------------------ the fixture, read as data */

/** One member of the model, as it records one. */
export type ModelMember = {
  id: string;
  class: string;
  mark: string;
  level: string;
  stack?: string;
  geom?: string;
  b?: string;
  d?: string;
  h?: string;
  sx?: string;
  sy?: string;
  nbar?: number;
  dbar?: number;
  depth?: string;
  depth2?: string;
  supports?: [string, string][];
};

/** One bar of the model. */
export type ModelBar = { member: string; class: string; role: string; shape: string; dia: number; n: number; zones?: { zone: string; length_mm: string; spacing_mm: string }[] | null };

/** The model, whole. */
export type Model = { storeys: Record<string, string>; members: ModelMember[]; bars: ModelBar[] };

/** One row of the bar-bending golden. */
export type GoldenBar = { member: string; class: string; level: string; mark: string; role: string; shape: string; dia_mm: number; bars_per_unit: number };

/** The model the generator's own path wrote (`fixtures/rcc6-bnbc/model.json`). */
export function readModel(): Model {
  return JSON.parse(readFileSync(join(REPO_ROOT, BNBC_MODEL), "utf8")) as Model;
}

/** The corrected golden's bar rows (`fixtures/rcc6-bnbc/bbs.golden.json`). */
export function readGoldenBars(): GoldenBar[] {
  return (JSON.parse(readFileSync(join(REPO_ROOT, "fixtures/rcc6-bnbc/bbs.golden.json"), "utf8")) as { rows: GoldenBar[] }).rows;
}

/** The storeys bottom to top, in the order the model states them (FDN … ROOF). */
export function storeyOrder(model: Model): string[] {
  return Object.keys(model.storeys);
}

/** The storey a column's top meets: the next one up, or undefined for the top of the stack. */
export function storeyAbove(model: Model, level: string): string | undefined {
  const order = storeyOrder(model);
  const at = order.indexOf(level);
  return at < 0 ? undefined : order[at + 1];
}

/** The two spacings and the tie bar each mark's schedule states (`10Ø@100/150`), read off its tie rows' zones. */
export function markSpacings(model: Model): Map<string, { end: string; mid: string; bar: number }> {
  const markOf = new Map(model.members.map((member) => [member.id, member.mark]));
  const held = new Map<string, { end: string; mid: string; bar: number }>();
  for (const bar of model.bars) {
    if (bar.class !== "COLUMN" || bar.role !== "TIE") continue;
    const zones = bar.zones ?? [];
    const end = zones.find((one) => one.zone === "END");
    const mid = zones.find((one) => one.zone === "MID");
    if (end === undefined || mid === undefined) continue;
    const mark = markOf.get(bar.member) as string;
    if (!held.has(mark)) held.set(mark, { end: end.spacing_mm, mid: mid.spacing_mm, bar: bar.dia });
  }
  // a mark tied at one spacing throughout (C7's `10Ø@100/100`) states it once
  for (const bar of model.bars) {
    if (bar.class !== "COLUMN" || bar.role !== "TIE") continue;
    const mark = markOf.get(bar.member) as string;
    const all = (bar.zones ?? []).find((one) => one.zone === "ALL");
    if (!held.has(mark) && all !== undefined && bar.shape === "CH") held.set(mark, { end: all.spacing_mm, mid: all.spacing_mm, bar: bar.dia });
  }
  return held;
}

/**
 * The framing depths meeting one column's top: each beam registered on the storey above whose
 * supports name the column's stack, at the depth of the end that meets it (the model's `depth` for
 * its first support, `depth2` for its second) — the generator's own `tie_zones_from_framing`.
 */
export function framingAt(model: Model, column: ModelMember, keep: (beam: ModelMember) => boolean = () => true): { beam: ModelMember; depthMm: string }[] {
  const above = storeyAbove(model, column.level);
  if (above === undefined) return [];
  const held: { beam: ModelMember; depthMm: string }[] = [];
  for (const beam of model.members) {
    if (beam.class !== "BEAM" || beam.level !== above || !keep(beam)) continue;
    (beam.supports ?? []).forEach((support, at) => {
      if (support[0] === "COLUMN" && support[1] === column.stack) held.push({ beam, depthMm: String(at === 0 ? beam.depth : beam.depth2) });
    });
  }
  return held;
}

/**
 * The beams the partition placed before FRM-3 (session 8's read-back, the ties map's `bounded.py`):
 * the axis-x beams of the 1F plan, the typical plan and the roof plan. The axis-y beams, CB1–4, LB1
 * and TG1 wait on FRM-3; the slanted EB2 and PB wait on D13.
 */
export function placedBeforeFrm3(beam: ModelMember): boolean {
  const range = (prefix: string, last: number): Set<string> => new Set(Array.from({ length: last }, (_, at) => `${prefix}${String(at + 1)}`));
  if (beam.level === "1F") return range("1B", 22).has(beam.mark) || beam.mark === "1EB1";
  if (["2F", "3F", "4F", "5F", "6F"].includes(beam.level)) return range("B", 24).has(beam.mark) || beam.mark === "EB1";
  if (beam.level === "ROOF") return range("RB", 24).has(beam.mark);
  return false;
}

/** The deepest of a list of exact decimals, compared as numbers of tenths (every depth here is one). */
export function deepestOf(depths: readonly string[]): string | undefined {
  let held: string | undefined;
  for (const depth of depths) if (held === undefined || Number(depth) > Number(held)) held = depth;
  return held;
}

/* ------------------------------------------------------------------ the oracle, in 1/240 mm */

/** A decimal stated to at most a tenth of a millimetre, in whole 1/240 mm. */
export function units(mm: string): number {
  const stated = /^(\d+)(?:\.(\d+))?$/u.exec(mm);
  if (stated === null) throw new Error(`the oracle reads a non-negative decimal, and ${mm} is not one`);
  const fraction = stated[2] ?? "";
  if (/[1-9]/u.test(fraction.slice(1))) throw new Error(`the oracle reads figures to a tenth of a millimetre, and ${mm} is finer`);
  const tenth = fraction.slice(0, 1);
  return (Number(stated[1]) * 10 + Number(tenth === "" ? "0" : tenth)) * 24;
}

/** ⌊(x + ½ mm) ÷ s⌋ + 1, with x in 1/240 mm and s in millimetres — L-FRM-05's counting rule. */
function count(x: number, spacingMm: number): number {
  const over = x + 120;
  const per = 240 * spacingMm;
  return (over - (((over % per) + per) % per)) / per + 1;
}

/** The oracle's probe: a column's run, section and spacings, in millimetres as stated. */
export type OracleProbe = { h: string; b: string; d: string; se: number; sm: number };

/** A probe read once into whole 1/240 mm: the run and ℓo's section floor (the larger side, or 450). */
type OracleUnits = { h: number; largest: number; se: number; sm: number };

function unitsOf(probe: OracleProbe): OracleUnits {
  return { h: units(probe.h), largest: Math.max(units(probe.b), units(probe.d), units("450")), se: probe.se, sm: probe.sm };
}

/** N at a joint zone `jointUnits` deep, over a probe already read into 1/240 mm. */
function setsAt(probe: OracleUnits, jointUnits: number): number {
  const clear = probe.h - jointUnits;
  const lo = Math.max(probe.largest, clear / 6);
  if (!Number.isInteger(lo)) throw new Error("the oracle's clear/6 left the 1/240 mm lattice");
  if (probe.se === probe.sm || clear <= 2 * lo) return count(probe.h, probe.se);
  return 2 * count(lo, probe.se) + count(clear - 2 * lo, probe.sm) + count(jointUnits, probe.se);
}

/** N at a joint zone `jointUnits` deep (1/240 mm; already floored at 450 by the caller). */
export function oracleSetsAtUnits(probe: OracleProbe, jointUnits: number): number {
  return setsAt(unitsOf(probe), jointUnits);
}

/** N(D): the tie sets at a framing depth D, the joint floored at 450 (W-28 GC-4). */
export function oracleSetsAt(probe: OracleProbe, depthMm: string): number {
  return oracleSetsAtUnits(probe, Math.max(units(depthMm), units("450")));
}

/**
 * The walks already made, by probe and bound. Many columns share a mark's section and spacings and a
 * storey's run, so a proof over the model asks the same question many times; the answer is the same
 * exhaustive walk, made once.
 */
const walked = new Map<string, number>();

/** The exact minimum of N over [max(D_lo, 450), h), visiting every depth of the 1/40 mm lattice. */
export function oracleNeverOver(probe: OracleProbe, lowerMm: string): number {
  const key = JSON.stringify([probe.h, probe.b, probe.d, probe.se, probe.sm, lowerMm]);
  const known = walked.get(key);
  if (known !== undefined) return known;
  const read = unitsOf(probe);
  const from = Math.max(units(lowerMm), units("450"));
  let best = setsAt(read, from);
  for (let joint = from + 6; joint < read.h; joint += 6) {
    const sets = setsAt(read, joint);
    if (sets < best) best = sets;
  }
  walked.set(key, best);
  return best;
}

/* ------------------------------------------------------------------ the columns as a rail input */

/** One column of the input, with what the proofs read about it beside its register row. */
export type InputColumn = {
  member: ModelMember;
  objectKey: string;
  placementKey: string;
  levelId: string;
  round: boolean;
  spacing: { end: string; mid: string; bar: number } | undefined;
};

/** How each column's top joint is stated in the input. */
export type JointsMode = "none" | "placed" | "drawn";

/** What a caller asks the model input for. */
export type ColumnsInputOptions = {
  joints: JointsMode;
  methods?: readonly MethodPairShape[];
  detailing: DetailingSetupShape;
};

/** The level id a storey stands under in the input's stack. */
export function levelIdOf(storey: string): string {
  return `level:${storey}`;
}

/**
 * Every column of the model, as one rail input. `joints` states each column's top joint as the
 * seam would answer it: "none" carries no joint at all; "placed" bounds a column by the framing
 * `placedBeforeFrm3` stands for (UNREAD FRAMING where none of it meets the column, UNREAD LEVEL at the
 * top of the stack); "drawn" bounds it by every beam the model frames it with.
 */
export function modelColumnsInput(options: ColumnsInputOptions): { input: RailInputShape; columns: InputColumn[] } {
  const model = readModel();
  const order = storeyOrder(model);
  const spacings = markSpacings(model);
  const levels = order.map((storey, ordinal) => levelStanding({ levelId: levelIdOf(storey), label: storey, ordinal, value: model.storeys[storey] as string, sourceKey: `${BNBC_MODEL}#storeys:${storey}` }));
  const objects: Record<string, unknown>[] = [];
  const placements: Record<string, PlacementSetupShape> = {};
  const memberTypes: Record<string, readonly VariantSetupShape[]> = {};
  const joints: Record<string, JointReadingShape> = {};
  const columns: InputColumn[] = [];
  for (const member of model.members) {
    if (member.class !== "COLUMN") continue;
    const placementKey = `placement:${member.id}`;
    const levelId = levelIdOf(member.level);
    const row = registerRow({ placementKey, levelId, levelLabel: member.level, mark: member.mark, elementType: COLUMN_CLASS });
    const objectKey = String(row["objectKey"]);
    const family = `${member.mark}:${member.id}`;
    const round = member.geom === "CYL";
    placements[placementKey] = { ...placement({ placementKey, memberFamily: family }), noteShape: round ? "ROUND" : null, noteKey: null };
    const spacing = spacings.get(member.mark);
    const rebar = [zone({ zone: "main", bars: [{ n: Number(member.nbar), diameterMm: Number(member.dbar) }], sourceKeys: [`${BNBC_MODEL}#${member.id}.main`] })];
    if (spacing !== undefined) {
      rebar.push(
        zone({ zone: "ties-end", spacing: Number(spacing.end), spacingUnit: "mm", spacingBar: spacing.bar, sourceKeys: [`${BNBC_MODEL}#${member.mark}.ties`] }),
        zone({ zone: "ties-mid", spacing: Number(spacing.mid), spacingUnit: "mm", spacingBar: spacing.bar, sourceKeys: [`${BNBC_MODEL}#${member.mark}.ties`] }),
      );
    }
    memberTypes[family] = [variant({ variantKey: family, width: Number(member.b), depth: Number(member.d), sourceKeys: [`${BNBC_MODEL}#${member.id}.section`], rebar })];
    objects.push(row);
    columns.push({ member, objectKey, placementKey, levelId, round, spacing });

    if (options.joints === "none") continue;
    const above = storeyAbove(model, member.level);
    if (above === undefined) {
      joints[objectKey] = { standing: "UNREAD", unread: "LEVEL", levelId: null, depthUnread: [] };
      continue;
    }
    const framing = framingAt(model, member, options.joints === "placed" ? placedBeforeFrm3 : () => true);
    const deepest = deepestOf(framing.map((one) => one.depthMm));
    if (deepest === undefined) {
      joints[objectKey] = { standing: "UNREAD", unread: "FRAMING", levelId: levelIdOf(above), depthUnread: [] };
      continue;
    }
    const framers = framing
      .filter((one, at) => framing.findIndex((other) => other.beam.id === one.beam.id) === at)
      .map((one) => ({ objectKey: `beam:${one.beam.id}`, placementKey: `placement:${one.beam.id}`, family: one.beam.mark, depth: reading(one.depthMm, "mm", { source: `${BNBC_MODEL}#${one.beam.id}.section` }), depthMm: one.depthMm }));
    const top = framers.find((one) => one.depthMm === deepest) as (typeof framers)[number];
    joints[objectKey] = { standing: "BOUNDED", levelId: levelIdOf(above), depthMm: deepest, deepest: top, framing: framers, depthUnread: [] };
  }
  const input = railInput({ objects, placements, memberTypes, levels, detailing: options.detailing });
  const setup = { ...input.setup, edition: { ...input.setup.edition, ...(options.methods === undefined ? {} : { methods: options.methods }) }, ...(options.joints === "none" ? {} : { joints }) };
  return { input: { ...input, setup }, columns };
}

/**
 * The J-000 detailing: `LAP 50d` stated and agreed, the hook stated at 10d (75 minimum), and the mix
 * contested (the pile note's 3000 psi beside the columns' 3500).
 */
export function detailingLap50MixContested(): DetailingSetupShape {
  return { fy: null, fc: null, lapMultiplier: 50, hookExtension: { multiplier: 10, minimumMm: 75 }, suspended: ["FC"], sourceKeys: [`${BNBC_MODEL}#notes:LAP`] };
}
