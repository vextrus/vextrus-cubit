// The model-call ledger's closed vocabulary and its money (L-AI-01, AS-05): the model ids a call may
// be pinned to, the rate each of them is charged at, and the one derivation that turns tokens into
// the cost a ledger row attributes. Every transport and every surface that reports spend derives it
// here (B-17) — a second derivation would be a second answer about the same money.

/** The model ids a call may name, closed (AS-05): a call pins its model by id from this const. */
export const MODEL_IDS = ["claude-opus-5", "claude-sonnet-5"] as const;

/** One of the ids above, derived from the const so the type and the set can never drift apart. */
export type ModelId = (typeof MODEL_IDS)[number];

/**
 * What a model costs, in USD per million tokens of each direction. Decimal strings rather than
 * numbers: a rate held as a binary float is a rate no exact derivation can start from.
 */
export type ModelRate = { readonly inputPerMillionTokens: string; readonly outputPerMillionTokens: string };

/**
 * The pinned rates, total over the closed const — an id without a rate is a call nobody can bill.
 * Frozen at every depth: a rate is a fact about money (L-AI-01), and a table a caller could edit at
 * runtime would make the derivation answer for a rate nobody pinned.
 */
export const MODEL_RATES: Readonly<Record<ModelId, ModelRate>> = Object.freeze({
  "claude-opus-5": Object.freeze({ inputPerMillionTokens: "15", outputPerMillionTokens: "75" }),
  "claude-sonnet-5": Object.freeze({ inputPerMillionTokens: "3", outputPerMillionTokens: "15" }),
});

/** The denominator the rates are quoted against, as the power of ten a cost is divided by. */
const RATE_DENOMINATOR_SCALE = 6;

const TEN = 10n;

/** The spellings this module reads a decimal number out of and writes one back in. */
const DECIMAL = /^(-?)([0-9]+)(?:\.([0-9]*))?$/;

/**
 * A decimal number in its minimal spelling: no exponent, no trailing zero in the fraction, no
 * leading zero in the integer part. Money arrives here from two places — this module's own
 * derivation and the numeric sums the database answers with — and both are spelled the one way, so
 * `3`, `3.00` and `03` are never three different answers about the same money (B-17).
 */
export function minimalDecimal(value: string): string {
  const match = DECIMAL.exec(value.trim());
  if (match === null) {
    throw new Error(`${JSON.stringify(value)} is not a decimal number the model-call ledger can spell`);
  }
  const integer = (match[2] ?? "").replace(/^0+(?=[0-9])/, "");
  const fraction = (match[3] ?? "").replace(/0+$/, "");
  const negative = match[1] === "-" && !(integer === "0" && fraction === "");
  return `${negative ? "-" : ""}${integer}${fraction === "" ? "" : `.${fraction}`}`;
}

/** A decimal string as an exact count of units, and the power of ten those units are counted in. */
function scaledUnits(decimal: string): { units: bigint; scale: number } {
  const match = DECIMAL.exec(decimal.trim());
  if (match === null || match[1] === "-") {
    throw new Error(`${JSON.stringify(decimal)} is not a rate: a rate is a decimal number of USD per million tokens`);
  }
  const fraction = match[3] ?? "";
  return { units: BigInt(`${match[2] ?? "0"}${fraction}`), scale: fraction.length };
}

/** Units counted in one power of ten, spelled as a decimal number. */
function spellScaled(units: bigint, scale: number): string {
  const digits = (units < 0n ? -units : units).toString().padStart(scale + 1, "0");
  const point = digits.length - scale;
  const spelled = scale === 0 ? digits : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return minimalDecimal(`${units < 0n ? "-" : ""}${spelled}`);
}

/**
 * Is this figure a token count — a whole, non-negative number a double counts exactly? The one
 * judgement (B-17): the money derivation below throws through it, and every transport that reads a
 * figure off a fixture or a provider body asks here rather than re-spelling the test.
 */
export function isTokenCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * A figure as the token count it is, or the one failure a figure that is not one raises — a fault,
 * not a cost to guess at. `modelCallCost` and the transports fail through this same sentence, so a
 * count refused at the seam's edge and one refused at the derivation are the same refusal (B-17).
 */
export function tokenCount(value: unknown): number {
  if (!isTokenCount(value)) {
    throw new Error(`${JSON.stringify(value)} is not a token count — a call spends a whole, non-negative number of tokens`);
  }
  return value;
}

/**
 * What a call of this model, spending these tokens, costs — as a minimal decimal string.
 *
 * The whole derivation is integer arithmetic over the rates' own digits: tokens and rate are
 * multiplied as scaled integers and the division by a million is done by placing the decimal point,
 * never by a binary float. A cost attributed to a tenant is money (L-AI-01), and money that rounds
 * on the way out of the derivation is not attribution.
 */
export function modelCallCost(modelId: ModelId, inputTokens: number, outputTokens: number): string {
  const rate = MODEL_RATES[modelId];
  if (rate === undefined) {
    throw new Error(`no rate is pinned for the model id ${JSON.stringify(modelId)} — the model-call ledger charges only ${MODEL_IDS.join(", ")} (AS-05)`);
  }
  const input = scaledUnits(rate.inputPerMillionTokens);
  const output = scaledUnits(rate.outputPerMillionTokens);
  const scale = Math.max(input.scale, output.scale);
  const units =
    BigInt(tokenCount(inputTokens)) * input.units * TEN ** BigInt(scale - input.scale) +
    BigInt(tokenCount(outputTokens)) * output.units * TEN ** BigInt(scale - output.scale);
  return spellScaled(units, scale + RATE_DENOMINATOR_SCALE);
}
