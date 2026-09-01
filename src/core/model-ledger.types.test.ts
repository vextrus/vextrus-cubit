// AC-3, the half that needs no database: the closed model-id const (AS-05), the per-model-id rate
// table, and a cost derivation that never touches binary floating point (L-AI-01 attributes tokens
// to a tenant, and an attribution that rounds is not an attribution).
//
// The module is loaded by absolute path rather than by a literal specifier, so a module the product
// does not provide yet fails as an assertion naming the file instead of killing collection at
// transform time. Its TYPES are reached in type position, which the transform erases and `tsc`
// checks — that is where "ModelId is derived from MODEL_IDS" and "MODEL_RATES is total over
// ModelId" can be judged at all.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The home the increment names for the closed const, the rates and the cost derivation. */
const MODULE = "src/core/model-ledger.types.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The two model ids AS-05 closes the set to, and the rates this spec pins (USD per million). */
const OPUS = "claude-opus-5";
const SONNET = "claude-sonnet-5";
const PINNED_RATES: Record<string, { inputPerMillionTokens: string; outputPerMillionTokens: string }> = {
  [OPUS]: { inputPerMillionTokens: "15", outputPerMillionTokens: "75" },
  [SONNET]: { inputPerMillionTokens: "3", outputPerMillionTokens: "15" },
};

/** A million: the denominator the rates are quoted against. */
const MILLION = 1_000_000;

/* ------------------------------------------------------------------ *
 * Compile-time acceptance. `tsc` is the runner for these; the aliases
 * are gathered into one exported type so nothing here is an unused local.
 * ------------------------------------------------------------------ */

type Expect<T extends true> = T;
type Not<T extends boolean> = T extends true ? false : true;
type Assignable<From, To> = [From] extends [To] ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type ModelId = import("./model-ledger.types").ModelId;
type Ids = typeof import("./model-ledger.types").MODEL_IDS;
type Rates = typeof import("./model-ledger.types").MODEL_RATES;
type Cost = typeof import("./model-ledger.types").modelCallCost;
type Rate = { inputPerMillionTokens: string; outputPerMillionTokens: string };

/** MODEL_IDS is a closed const of literals — not `readonly string[]`, which closes nothing. */
type IdsAreTheTwoLiterals = Expect<Equal<Ids[number], typeof OPUS | typeof SONNET>>;
/** ModelId is DERIVED from it (AS-05), so the two can never drift apart. */
type ModelIdIsDerived = Expect<Equal<ModelId, Ids[number]>>;
/** MODEL_RATES is total over ModelId, and carries no key that is not one. */
type RatesAreTotal = Expect<Equal<keyof Rates, ModelId>>;
type RatesCarryBothDirections = Expect<Assignable<Rates, Record<ModelId, Rate>>>;
/** The cost derivation takes a ModelId and two token counts, and answers a string. */
type CostTakesAModelId = Expect<Assignable<Cost, (modelId: ModelId, inputTokens: number, outputTokens: number) => string>>;
/** And it must NOT take an arbitrary string: a closed const nothing is checked against is not closed. */
type CostRefusesAnyString = Expect<Not<Assignable<Cost, (modelId: string, inputTokens: number, outputTokens: number) => string>>>;

export type CompileTimeAcceptance = [
  IdsAreTheTwoLiterals,
  ModelIdIsDerived,
  RatesAreTotal,
  RatesCarryBothDirections,
  CostTakesAModelId,
  CostRefusesAnyString,
];

/* ------------------------------------------------------------------ *
 * The module, as its callers see it at runtime.
 * ------------------------------------------------------------------ */

type CostFn = (modelId: string, inputTokens: number, outputTokens: number) => string;
type Ledger = {
  MODEL_IDS?: readonly string[];
  MODEL_RATES?: Record<string, { inputPerMillionTokens?: string; outputPerMillionTokens?: string }>;
  modelCallCost?: CostFn;
};

let loading: Promise<Ledger> | undefined;

const ledger = (): Promise<Ledger> =>
  (loading ??= (async () => {
    const abs = join(REPO_ROOT, MODULE);
    expect(
      existsSync(abs) && statSync(abs).isFile(),
      `${MODULE} is missing from the checkout — AS-05's closed model-id const, its rates and the cost derivation live there`,
    ).toBe(true);
    const specifier: string = abs;
    return (await import(specifier)) as Ledger;
  })());

async function modelIds(): Promise<readonly string[]> {
  const ids = (await ledger()).MODEL_IDS;
  expect(Array.isArray(ids), `${MODULE} exports no MODEL_IDS array — AS-05 pins the model by id from a closed const`).toBe(true);
  return ids ?? [];
}

async function modelRates(): Promise<Record<string, { inputPerMillionTokens?: string; outputPerMillionTokens?: string }>> {
  const rates = (await ledger()).MODEL_RATES;
  expect(typeof rates === "object" && rates !== null, `${MODULE} exports no MODEL_RATES record — a cost cannot be attributed without one`).toBe(true);
  return rates ?? {};
}

async function cost(): Promise<CostFn> {
  const fn = (await ledger()).modelCallCost;
  expect(typeof fn, `${MODULE} exports no modelCallCost(modelId, inputTokens, outputTokens)`).toBe("function");
  return fn ?? ((): string => "");
}

/** A decimal string in its minimal spelling, so '15' and '15.00' are compared as the same money. */
function minimal(value: string): string {
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(value)) return value;
  const trimmed = value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
  return trimmed.replace(/^(-?)0+([0-9])/, "$1$2");
}

/* ------------------------------------------------------------------ *
 * AC-3: the closed const and its rates.
 * ------------------------------------------------------------------ */

describe("AC-3: the model-id const and the rate table (AS-05)", () => {
  it("AC-3: MODEL_IDS is a closed const holding exactly the two model ids this spec pins", async () => {
    const ids = await modelIds();
    expect([...ids].sort(), `MODEL_IDS is the closed set AS-05 names — exactly ${OPUS} and ${SONNET}`).toEqual([OPUS, SONNET].sort());
    expect(new Set(ids).size, "MODEL_IDS holds no id twice").toBe(ids.length);
  });

  it("AC-3: MODEL_RATES is total over MODEL_IDS and carries the pinned decimal-string rates", async () => {
    const ids = await modelIds();
    const rates = await modelRates();
    expect(Object.keys(rates).sort(), "MODEL_RATES is a total record over MODEL_IDS — no id without a rate, no rate without an id").toEqual([...ids].sort());
    for (const id of ids) {
      const rate = rates[id];
      const pinned = PINNED_RATES[id];
      expect(pinned, `${id} is in MODEL_IDS but this spec pins no rate for it`).toBeDefined();
      expect(typeof rate?.inputPerMillionTokens, `MODEL_RATES.${id}.inputPerMillionTokens is a decimal string, never a number — a float rate makes every cost a float`).toBe("string");
      expect(typeof rate?.outputPerMillionTokens, `MODEL_RATES.${id}.outputPerMillionTokens is a decimal string`).toBe("string");
      expect(minimal(rate?.inputPerMillionTokens ?? ""), `MODEL_RATES.${id}.inputPerMillionTokens is USD ${pinned?.inputPerMillionTokens} per million tokens`).toBe(pinned?.inputPerMillionTokens);
      expect(minimal(rate?.outputPerMillionTokens ?? ""), `MODEL_RATES.${id}.outputPerMillionTokens is USD ${pinned?.outputPerMillionTokens} per million tokens`).toBe(pinned?.outputPerMillionTokens);
    }
  });
});

/* ------------------------------------------------------------------ *
 * AC-3: the cost derivation.
 * ------------------------------------------------------------------ */

describe("AC-3: modelCallCost derives an exact decimal string", () => {
  it("AC-3: the two costs this spec pins", async () => {
    const modelCallCost = await cost();
    expect(modelCallCost(SONNET, 1_000_000, 2_000_000), `${SONNET}: a million input tokens at 3 and two million output at 15 is 33`).toBe("33");
    expect(modelCallCost(OPUS, 100_000, 10_000), `${OPUS}: 100k input at 15/M is 1.5 and 10k output at 75/M is 0.75`).toBe("2.25");
  });

  it("AC-3: a million tokens in either direction costs exactly that direction's rate, for every id in the closed const", async () => {
    // The rule the two pinned examples are instances of, driven by MODEL_IDS rather than by a list
    // typed here — any model id the closed const comes to hold is judged by the same rule.
    const modelCallCost = await cost();
    const rates = await modelRates();
    for (const id of await modelIds()) {
      expect(modelCallCost(id, MILLION, 0), `${id}: a million input tokens costs inputPerMillionTokens exactly`).toBe(minimal(rates[id]?.inputPerMillionTokens ?? ""));
      expect(modelCallCost(id, 0, MILLION), `${id}: a million output tokens costs outputPerMillionTokens exactly`).toBe(minimal(rates[id]?.outputPerMillionTokens ?? ""));
      expect(modelCallCost(id, 0, 0), `${id}: a call that spent no tokens costs nothing, spelled minimally`).toBe("0");
    }
  });

  it("AC-3: the answer is a minimal decimal string — no exponent, no trailing zeros, no leading zeros", async () => {
    const modelCallCost = await cost();
    const shapes = [
      [SONNET, 1, 0],
      [SONNET, 0, 1],
      [OPUS, 1, 1],
      [OPUS, 7, 13],
      [SONNET, 999_999, 1],
      [OPUS, 2_147_483_647, 2_147_483_647],
    ] as const;
    for (const [id, input, output] of shapes) {
      const answer = modelCallCost(id, input, output);
      expect(answer, `modelCallCost(${id}, ${input}, ${output}) must be a plain decimal string, never exponent notation`).toMatch(/^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/);
    }
    // The smallest money either model can charge: one input token of the cheaper rate. A derivation
    // that reaches for Number's own printing answers this one correctly and the next one wrongly.
    expect(modelCallCost(SONNET, 1, 0), "one input token at 3 USD per million is 0.000003, spelled in full").toBe("0.000003");
  });

  it("AC-3: the derivation is float-free — a binary-float scaling loses the last digit here", async () => {
    // 1_000_000_000_000_001 is an exact JavaScript integer (it is under 2^53), and so is the money
    // owed for it: 1_000_000_000_000_001 x 15 / 1_000_000 = 15000000000.000015 exactly. Scaled
    // through a double, the product 15000000000000015 rounds to ...016 and the answer comes back
    // one cent-of-a-millionth wrong. Only a scaled-integer or BigInt derivation answers this.
    const modelCallCost = await cost();
    expect(
      modelCallCost(OPUS, 1_000_000_000_000_001, 0),
      "modelCallCost must not scale through binary floating point (AC-3: 'computed without binary floating point')",
    ).toBe("15000000000.000015");
  });
});
