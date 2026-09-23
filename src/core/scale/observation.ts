// A QS two-point observation, judged (L-MEA-05): "each point cites a source key + world coordinate
// quantised to 0.1 unit; a free click refuses SCALE_OBSERVATION_UNCITED; the stated distance is
// ENTERED". X and Y derive independently and are averaged as nothing, so an observation speaks for
// exactly one axis, and a single observation on an axis is verified at the edition's tolerance or
// rejected. Pure — the store, the artifact and the edition are the caller's to bring.
import type { GridAxis } from "../db";
// The key grammar comes from its own home rather than the model seam's barrel: that barrel reaches
// the store, and a two-point observation is judged in the browser as well as on the server, where
// dragging `pg` in behind one pure guard is a build error rather than an opinion (ARCH-01, B-17).
import { parseSourceKey } from "../sources";
import { FACTOR_MINIMUM, exact, isFactorString, isScaleUnit, metresPerExact, renderFactor, withinTolerance, type ScaleUnit } from "./law";
import { scaleNoEvidence, scaleObservationOblique, scaleObservationUncited, scaleObservationUnverified } from "./refusals";

/** A world axis a scale is derived along — the seam's own closed pair, never a second spelling (B-17). */
export type ScaleAxis = GridAxis;

const AXIS_X = "x" satisfies ScaleAxis;
const AXIS_Y = "y" satisfies ScaleAxis;

/** The one basis a lawful observation states for its distance: a person entered it (L-MEA-05). */
export const DISTANCE_BASIS_ENTERED = "ENTERED" as const;

/** One point of an observation: the entity it cites and where on the 0.1 lattice it was taken. */
export type CitedPoint = { readonly sourceKey: string; readonly x: string; readonly y: string };

/** The distance a person entered between the two points, in a unit of the closed lane. */
export type EnteredDistance = { readonly value: string; readonly unit: ScaleUnit };

/** A two-point observation as the act is given one, before it has been judged. */
export type TwoPointObservation = {
  readonly points: readonly [CitedPoint, CitedPoint];
  readonly distance: EnteredDistance;
  readonly distanceBasis: typeof DISTANCE_BASIS_ENTERED;
};

/** An observation judged lawful: what it was, the axis it observes, what it spans and the factor that follows. */
export type CitedObservation = TwoPointObservation & {
  readonly axis: ScaleAxis;
  /** The absolute difference along the observed axis, in drawing units, as the lattice states it. */
  readonly drawn: string;
  /** The entered distance in metres over the drawn span, rendered to 12 places. */
  readonly factor: string;
};

/** The shape a coordinate is written in: a decimal, signed or not, at whatever precision the caller renders. */
const DECIMAL_COORDINATE = /^-?[0-9]+(?:\.[0-9]+)?$/;

/**
 * How many steps of the lattice make one drawing unit: L-MEA-05 quantises a cited coordinate to 0.1
 * unit, which is a fact about the VALUE and not about its rendering — "20", "20.0" and "20.00" are
 * one point of the lattice, and a fixed-place formatter on the way in changes nothing.
 */
const LATTICE_STEPS_PER_UNIT = 10;

/** A distance a person entered: a positive decimal. */
const ENTERED_VALUE = /^[0-9]+(?:\.[0-9]+)?$/;

/**
 * Judge a raw observation. It arrives as `unknown` because it is a person's input crossing a
 * transport: every field is read off it here, and a field that is not what the law asks for is the
 * refusal L-MEA-05 names rather than a type the caller vouched for.
 */
export function citeObservation(raw: unknown): CitedObservation {
  const held = objectOf(raw, "observation");
  const rawPoints = held["points"];
  if (!Array.isArray(rawPoints) || rawPoints.length !== 2) {
    throw scaleObservationUncited("an observation is exactly two cited points", { field: "points" });
  }
  const points: [CitedPoint, CitedPoint] = [citedPointOf(rawPoints[0]), citedPointOf(rawPoints[1])];

  const distance = enteredDistanceOf(held["distance"]);
  if (held["distanceBasis"] !== DISTANCE_BASIS_ENTERED) {
    throw scaleObservationUncited(`the distance of an observation is the one a person ENTERED, and this one states ${JSON.stringify(held["distanceBasis"])}`, {
      field: "distanceBasis",
    });
  }

  const [from, to] = points;
  const dx = exact(to.x).minus(from.x).abs();
  const dy = exact(to.y).minus(from.y).abs();
  const alongX = dx.gt(0);
  const alongY = dy.gt(0);
  if (alongX === alongY) {
    throw scaleObservationOblique(
      alongX ? "the two points differ along both axes, so they observe neither" : "the two points stand in the same place, so they observe nothing",
      { dx: dx.toString(), dy: dy.toString() },
    );
  }
  const axis = alongX ? AXIS_X : AXIS_Y;
  const drawn = alongX ? dx : dy;
  const factor = renderFactor(exact(distance.value).mul(metresPerExact(distance.unit)).div(drawn));
  // The rendering is the only way a factor is spoken, so a distance too small against the span it
  // was entered across leaves no factor at all — an answer the law names, never the plain Error the
  // next step (verifyAxis, factorPair) would fault with (ARCH-03, B-21).
  if (!isFactorString(factor)) {
    throw scaleObservationUnverified(
      `${distance.value} ${distance.unit} across ${drawn.toString()} drawing units is less than ${FACTOR_MINIMUM} metres per unit, which is the least scale the rendering can speak`,
      { axis, factor },
    );
  }

  return { points, distance, distanceBasis: DISTANCE_BASIS_ENTERED, axis, drawn: drawn.toString(), factor };
}

/** One point, read off the wire: a cited source key and two lattice coordinates, or the refusal. */
function citedPointOf(raw: unknown): CitedPoint {
  const held = objectOf(raw, "point");
  const sourceKey = held["sourceKey"];
  if (typeof sourceKey !== "string" || parseSourceKey(sourceKey) === null) {
    throw scaleObservationUncited("a calibration point cites a source key of the form scheme:key, and this one cites nothing", {
      sourceKey: typeof sourceKey === "string" ? sourceKey : "",
      field: "sourceKey",
    });
  }
  const x = latticeCoordinateOf(held["x"], "x", sourceKey);
  const y = latticeCoordinateOf(held["y"], "y", sourceKey);
  return { sourceKey, x, y };
}

/** A coordinate as the lattice states it, or the refusal — a free click lands anywhere, a cited point on the 0.1 grid. */
function latticeCoordinateOf(raw: unknown, field: ScaleAxis, sourceKey: string): string {
  if (typeof raw !== "string" || !DECIMAL_COORDINATE.test(raw) || !exact(raw).mul(LATTICE_STEPS_PER_UNIT).isInteger()) {
    throw scaleObservationUncited(`the ${field} of the point citing ${sourceKey} is not quantised to 0.1 unit`, { sourceKey, field });
  }
  return raw;
}

/** The entered distance, read off the wire: a positive value in a unit of the closed lane. */
function enteredDistanceOf(raw: unknown): EnteredDistance {
  const held = objectOf(raw, "distance");
  const value = held["value"];
  const unit = held["unit"];
  if (typeof value !== "string" || !ENTERED_VALUE.test(value) || !exact(value).gt(0)) {
    throw scaleObservationUncited("the entered distance is a positive decimal, and this one is not", { field: "distance.value" });
  }
  if (!isScaleUnit(unit)) {
    throw scaleObservationUncited(`the entered distance names a unit of the closed lane, and ${JSON.stringify(unit)} is not one`, { field: "distance.unit" });
  }
  return { value, unit };
}

/** The value as a record, or the refusal: nothing but an object carries the fields an observation has. */
function objectOf(raw: unknown, what: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw scaleObservationUncited(`a ${what} is an object carrying its fields, and this one is not`, { field: what });
  }
  return raw as Record<string, unknown>;
}

/** An observation as an axis's set reads one: the axis it speaks for, its factor and the two points it spans. */
export type ObservedSpan = { readonly axis: ScaleAxis; readonly factor: string; readonly points: readonly [CitedPoint, CitedPoint] };

/**
 * Whether two observations span the same two points of the lattice, whichever end was picked first
 * and whichever entity each point cited. A point is its place on the lattice compared as a value:
 * `20`, `20.0` and `20.00` are one point, exactly as `citeObservation` quantises them.
 */
export function sameSpan(left: readonly [CitedPoint, CitedPoint], right: readonly [CitedPoint, CitedPoint]): boolean {
  return spanKey(left) === spanKey(right);
}

/** One span as a key that names it whichever end was picked first: its two lattice points, as values, in order. */
function spanKey(points: readonly [CitedPoint, CitedPoint]): string {
  const [from, to] = points.map((point) => `${exact(point.x).toString()} ${exact(point.y).toString()}`) as [string, string];
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

/** What verifying an axis answers: the factor the axis stands at and what vouched for it. */
export type AxisVerification = {
  readonly axis: ScaleAxis;
  readonly factor: string;
  /** The factors that agreed with the first observation within tolerance — other observations, or the drawing's own evidence. */
  readonly verifiedBy: readonly string[];
};

/**
 * Where one axis of a two-point calibration stands over the observations taken along it — the ONE
 * judgement the act refuses by and the panel's door reads, so a door the panel opens is a door the
 * act behind it takes (B-17, I-419). Four answers, each a reading and never a fault:
 *
 * - `absent` — nobody observed this axis;
 * - `disagreeing` — an observation along it differs from the FIRST beyond tolerance (`against`);
 * - `single` — every observation agrees with the first, but none measured a span of its own and
 *   nothing the drawing reads for these views agrees with it either (`against`: what it was held to);
 * - `verified` — the first observation's factor, vouched for by `verifiedBy`.
 */
export type AxisStanding =
  | { readonly axis: ScaleAxis; readonly state: "absent" }
  | { readonly axis: ScaleAxis; readonly state: "disagreeing" | "single"; readonly factor: string; readonly against: readonly string[] }
  | ({ readonly state: "verified" } & AxisVerification);

/**
 * One axis judged over a SET of observations (L-MEA-05, I-419). Two observations verify each
 * other because they are two MEASUREMENTS: the same two points taken twice are one measurement, so
 * a repeat of the first observation's span agrees or disagrees with it and never vouches for it —
 * only an observation across other points does. Nothing is dropped: every observation along the axis,
 * a repeat included, is held to the first, and one that disagrees is the refusal, never set aside. So
 * two agreeing observations per axis across different points scale a view with nothing machine-made
 * under them, which is how a sheet the drawing offers no scale for is scaled at all.
 */
export function axisStandingOf(axis: ScaleAxis, observations: readonly ObservedSpan[], corroborating: readonly string[], tolerance: string): AxisStanding {
  const along = observations.filter((observation) => observation.axis === axis);
  const first = along[0];
  return judged(
    axis,
    along.map((observation) => ({ factor: observation.factor, ownSpan: first !== undefined && !sameSpan(observation.points, first.points) })),
    corroborating,
    tolerance,
  );
}

/** `axisStandingOf`, answered as the act needs it: the verification, or the refusal L-MEA-05 names. */
export function verifyObservations(axis: ScaleAxis, observations: readonly ObservedSpan[], corroborating: readonly string[], tolerance: string): AxisVerification {
  return verificationOf(axisStandingOf(axis, observations, corroborating, tolerance), tolerance);
}

/**
 * Verify one axis of a two-point calibration (L-MEA-05: "a single-observation scale is verified at
 * ±1% or rejected"). The axis stands at the FIRST observation's factor — never at an average — and
 * that factor is verified either by every further observation along the same axis agreeing with it
 * within tolerance, or, for a single observation, by at least one factor the drawing's own evidence
 * offers along that axis (a machine proposal at ranks 2–4). An axis nobody observed is no evidence
 * at all, which is the positive-membership refusal rather than a factor borrowed from another rank.
 * Factors alone carry no span, so each is read as a measurement of its own; where the observations
 * are at hand, `verifyObservations` reads their spans too (I-419).
 */
export function verifyAxis(axis: ScaleAxis, observed: readonly string[], corroborating: readonly string[], tolerance: string): AxisVerification {
  return verificationOf(
    judged(
      axis,
      observed.map((factor, at) => ({ factor, ownSpan: at > 0 })),
      corroborating,
      tolerance,
    ),
    tolerance,
  );
}

/** One reading of an axis's set: its factor, and whether it measured a span other than the first's. */
type Reading = { readonly factor: string; readonly ownSpan: boolean };

/** The one arithmetic under `axisStandingOf` and `verifyAxis`: the first reading, held to by all. */
function judged(axis: ScaleAxis, readings: readonly Reading[], corroborating: readonly string[], tolerance: string): AxisStanding {
  const [first, ...others] = readings;
  if (first === undefined) return { axis, state: "absent" };
  for (const factor of [first.factor, ...others.map((reading) => reading.factor), ...corroborating]) {
    if (!isFactorString(factor)) throw new Error(`"${factor}" is not a factor string, so it can verify nothing (L-MEA-05)`);
  }

  const disagreeing = others.filter((reading) => !withinTolerance(first.factor, reading.factor, tolerance)).map((reading) => reading.factor);
  if (disagreeing.length > 0) return { axis, state: "disagreeing", factor: first.factor, against: disagreeing };
  const measured = others.filter((reading) => reading.ownSpan).map((reading) => reading.factor);
  if (measured.length > 0) return { axis, state: "verified", factor: first.factor, verifiedBy: measured };

  const agreeing = corroborating.filter((factor) => withinTolerance(first.factor, factor, tolerance));
  if (agreeing.length === 0) return { axis, state: "single", factor: first.factor, against: [...corroborating] };
  return { axis, state: "verified", factor: first.factor, verifiedBy: agreeing };
}

/** A standing as the act answers it: the verification, or the refusal the standing names. */
function verificationOf(standing: AxisStanding, tolerance: string): AxisVerification {
  switch (standing.state) {
    case "verified":
      return { axis: standing.axis, factor: standing.factor, verifiedBy: standing.verifiedBy };
    case "absent":
      throw scaleNoEvidence(`no observation was taken along ${standing.axis}, and X and Y derive independently`, { axis: standing.axis });
    case "disagreeing":
      throw scaleObservationUnverified(`the observations along ${standing.axis} disagree beyond ±${tolerance} of the first`, {
        axis: standing.axis,
        factor: standing.factor,
        tolerance,
        against: standing.against,
      });
    case "single":
      throw scaleObservationUnverified(`the single observation along ${standing.axis} is verified by nothing within ±${tolerance}`, {
        axis: standing.axis,
        factor: standing.factor,
        tolerance,
        against: standing.against,
      });
  }
}
