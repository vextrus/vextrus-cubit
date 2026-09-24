/**
 * S0 (C-13): S-Measure's Design Decision is the one home of the manual-measurement law readings
 * that S1–S11 build on. This is its lane: the unit lane, which `pnpm verify` runs. The slice's spec
 * names "the docs lane in pnpm verify", and no such lane reads `docs/design` (`test:docs` is the Typst
 * document lane), so the Decision's own guard stands here.
 *
 * It holds the Decision to three things:
 * - its record is whole. §0 and §11 name the same Interpretations, each verdict is one of the
 *   refuter's four words, the blinding reading's Deviation is entered if the refuter rejects it,
 *   and §3 rules R-UI-050's seven states;
 * - it names only tokens the stylesheets define, and no primitive ramp (R-UI-086);
 * - I-393's readings of J-000's ring are the committed fixture's. Each row of its table is
 *   recomputed here from the DXF's own entities (the slab outline 81D, the blinding LINEs 824–827
 *   and 2309, the lift pit 830), from `model.json` and from the golden. A misread figure, like the ones the
 *   slice's review found (the yardstick's 5.957 m² read as columns alone, and the porch column
 *   counted inside the ring), or a regenerated fixture that moves the ring, goes red here before a
 *   slice builds on it.
 *
 * The arithmetic is exact: decimals as scaled BigInts, never floats, as the Decision asks of the
 * product (I-380, I-385). Interpretation ids are matched by shape (I-nnn).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const DECISION = "docs/design/s-measure.md";
const DEVIATIONS = "docs/decisions/deviations.md";
const DXF = "fixtures/rcc6-bnbc/rcc6-bnbc.dxf";
const MODEL = "fixtures/rcc6-bnbc/model.json";
const GOLDEN = "fixtures/rcc6-bnbc/takeoff.golden.json";

/** An Interpretation's id, as a token before integration or as a number after it. */
const INTERPRETATION = "I-(?:S[0-9]+-[a-z]|[0-9]{3})";

/** R-UI-050's seven, in the clause's order. */
const R_UI_050_STATES = ["loading", "empty", "error", "refusal", "partial", "offline", "permission-denied"];

/** The refuter's verdicts, and the word for one not yet run. */
const VERDICTS = new Set(["OWED", "CONFIRMED", "AMENDED", "REJECTED"]);

// --- the Decision's text -----------------------------------------------------------------------

/** The body of the `## <heading>` section, up to the next `## `. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}`);
  expect(start, `the Decision has a section headed "${heading}"`).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

/** The cells of a markdown table row, trimmed; the row may be indented. */
const cells = (row: string): string[] =>
  row
    .trim()
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

/** §0's Interpretations: each token with its title line. */
function definedInterpretations(text: string): Map<string, string> {
  const defined = new Map<string, string>();
  const pattern = new RegExp(`^- \\*\\*(${INTERPRETATION}) — (.*)$`, "gm");
  for (const match of section(text, "0. Interpretations").matchAll(pattern)) {
    const [, token, title] = match;
    if (token !== undefined && title !== undefined) {
      expect(defined.has(token), `${token} is defined once in §0`).toBe(false);
      defined.set(token, title);
    }
  }
  return defined;
}

/** §11's refuter record: each token with its verdict cell. */
function refuterRows(text: string): Map<string, string> {
  const rows = new Map<string, string>();
  const pattern = new RegExp(`^\\| ${INTERPRETATION} \\|.*$`, "gm");
  for (const match of section(text, "11. Refuter record").matchAll(pattern)) {
    const [token, , , verdict] = cells(match[0]);
    if (token !== undefined && verdict !== undefined) {
      expect(rows.has(token), `${token} has one row in §11`).toBe(false);
      rows.set(token, verdict);
    }
  }
  return rows;
}

/** I-393's table of J-000 ring readings: label to value. */
function ringReadings(text: string): Map<string, string> {
  const lines = text.split("\n");
  const header = lines.findIndex((line) => line.trim().startsWith("| J-000 ring reading |"));
  expect(header, "I-393 states its ring readings in one table").toBeGreaterThanOrEqual(0);
  const readings = new Map<string, string>();
  for (const line of lines.slice(header + 2)) {
    if (!line.trim().startsWith("|")) break;
    const [label, value] = cells(line);
    if (label !== undefined && value !== undefined) readings.set(label, value);
  }
  return readings;
}

function reading(readings: Map<string, string>, label: string): string {
  const value = readings.get(label);
  expect(value, `I-393's table has the row "${label}"`).toBeDefined();
  return value ?? "";
}

// --- exact decimals ----------------------------------------------------------------------------

/** A decimal as an integer over a power of ten: value = n / 10^s. */
type Dec = { readonly n: bigint; readonly s: number };

function dec(text: string): Dec {
  const spelled = text.trim();
  expect(/^-?[0-9]+(\.[0-9]+)?$/.test(spelled), `"${spelled}" is a plain decimal spelling`).toBe(true);
  const [whole = "", fraction = ""] = spelled.replace("-", "").split(".");
  const n = BigInt(whole + fraction);
  return { n: spelled.startsWith("-") ? -n : n, s: fraction.length };
}

const TEN = BigInt(10);
const at = (a: Dec, s: number): bigint => a.n * TEN ** BigInt(s - a.s);
const add = (a: Dec, b: Dec): Dec => {
  const s = Math.max(a.s, b.s);
  return { n: at(a, s) + at(b, s), s };
};
const neg = (a: Dec): Dec => ({ n: -a.n, s: a.s });
const sub = (a: Dec, b: Dec): Dec => add(a, neg(b));
const mul = (a: Dec, b: Dec): Dec => ({ n: a.n * b.n, s: a.s + b.s });
const cmp = (a: Dec, b: Dec): number => {
  const d = sub(a, b).n;
  return d === BigInt(0) ? 0 : d > BigInt(0) ? 1 : -1;
};
const min = (a: Dec, b: Dec): Dec => (cmp(a, b) <= 0 ? a : b);
const max = (a: Dec, b: Dec): Dec => (cmp(a, b) >= 0 ? a : b);
const abs = (a: Dec): Dec => (a.n < BigInt(0) ? neg(a) : a);
const half = (a: Dec): Dec => ({ n: a.n * BigInt(5), s: a.s + 1 });
const ZERO = dec("0");

/** Divide by 10^k exactly. */
const shift = (a: Dec, k: number): Dec => ({ n: a.n, s: a.s + k });

/** Round half-even to `places` decimals. */
function round(a: Dec, places: number): Dec {
  if (a.s <= places) return a;
  const unit = TEN ** BigInt(a.s - places);
  const sign = a.n < BigInt(0) ? BigInt(-1) : BigInt(1);
  const magnitude = a.n * sign;
  let quotient = magnitude / unit;
  const remainder = magnitude % unit;
  if (remainder * BigInt(2) > unit || (remainder * BigInt(2) === unit && quotient % BigInt(2) === BigInt(1))) quotient += BigInt(1);
  return { n: quotient * sign, s: places };
}

/** The canonical spelling: no trailing zeros after the point. */
function spell(a: Dec): string {
  const negative = a.n < BigInt(0);
  const digits = (negative ? -a.n : a.n).toString().padStart(a.s + 1, "0");
  const whole = digits.slice(0, digits.length - a.s);
  const fraction = digits.slice(digits.length - a.s).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}

/** Rounded half-even to `places` and spelled with exactly that many decimals, as `quantise` spells. */
function fixed(a: Dec, places: number): string {
  const r = round(a, places);
  const whole = spell({ n: r.n * TEN ** BigInt(places - r.s), s: places });
  const [integer = whole, fraction = ""] = whole.split(".");
  return `${integer}.${fraction.padEnd(places, "0")}`;
}

type Point = { readonly x: Dec; readonly y: Dec };

/** The shoelace area of a ring, exactly. */
function shoelace(ring: readonly Point[]): Dec {
  let twice = ZERO;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length] as Point;
    twice = add(twice, sub(mul(p.x, q.y), mul(q.x, p.y)));
  });
  return half(abs(twice));
}

// --- the committed DXF -------------------------------------------------------------------------

type Entity = { readonly type: string; readonly codes: ReadonlyArray<readonly [string, string]> };

/** The ENTITIES section's entities in drawing order, each with its group codes in order. */
function dxfEntities(relative: string): Entity[] {
  const lines = read(relative).split(/\r?\n/);
  const entities: Entity[] = [];
  let section: string | null = null;
  let current: { type: string; codes: Array<readonly [string, string]> } | null = null;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = (lines[i] as string).trim();
    const value = (lines[i + 1] as string).trim();
    if (code === "0") {
      if (section === "ENTITIES" && current !== null) entities.push(current);
      current = { type: value, codes: [] };
      if (value === "ENDSEC") section = null;
    } else if (code === "2" && current?.type === "SECTION") {
      section = value;
    } else if (current !== null) {
      current.codes.push([code, value]);
    }
  }
  return entities;
}

const codeOf = (entity: Entity, code: string): string => {
  const found = entity.codes.find(([c]) => c === code);
  expect(found, `a ${entity.type} carries group code ${code}`).toBeDefined();
  return found?.[1] ?? "";
};

function byHandle(entities: readonly Entity[], handle: string): number {
  const index = entities.findIndex((entity) => entity.codes.some(([code, value]) => code === "5" && value === handle));
  expect(index, `the DXF holds the entity ${handle}`).toBeGreaterThanOrEqual(0);
  return index;
}

/** A heavy POLYLINE's vertices: the VERTEX entities that follow it, up to its SEQEND. */
function polylineRing(entities: readonly Entity[], handle: string): Point[] {
  const index = byHandle(entities, handle);
  expect(entities[index]?.type).toBe("POLYLINE");
  const ring: Point[] = [];
  for (const entity of entities.slice(index + 1)) {
    if (entity.type !== "VERTEX") break;
    ring.push({ x: dec(codeOf(entity, "10")), y: dec(codeOf(entity, "20")) });
  }
  return ring;
}

/** An LWPOLYLINE's points: each 10 with the 20 that follows it. */
function lwpolylineRing(entities: readonly Entity[], handle: string): Point[] {
  const entity = entities[byHandle(entities, handle)] as Entity;
  expect(entity.type).toBe("LWPOLYLINE");
  const ring: Point[] = [];
  entity.codes.forEach(([code, value], i) => {
    const next = entity.codes[i + 1];
    if (code === "10" && next !== undefined && next[0] === "20") ring.push({ x: dec(value), y: dec(next[1]) });
  });
  return ring;
}

/** A ring drawn as LINEs, one per edge in order: each LINE's start point. */
function lineRing(entities: readonly Entity[], handles: readonly string[]): Point[] {
  return handles.map((handle, i) => {
    const entity = entities[byHandle(entities, handle)] as Entity;
    expect(entity.type).toBe("LINE");
    const end = { x: dec(codeOf(entity, "11")), y: dec(codeOf(entity, "21")) };
    const nextHandle = handles[(i + 1) % handles.length] as string;
    const next = entities[byHandle(entities, nextHandle)] as Entity;
    expect(cmp(end.x, dec(codeOf(next, "10"))) === 0 && cmp(end.y, dec(codeOf(next, "20"))) === 0, `LINE ${handle} ends where ${nextHandle} starts`).toBe(true);
    return { x: dec(codeOf(entity, "10")), y: dec(codeOf(entity, "20")) };
  });
}

// --- the committed model -----------------------------------------------------------------------

type Member = Record<string, unknown> & { readonly id: string; readonly class: string; readonly level?: string };

const members = (): Member[] => (JSON.parse(read(MODEL)) as { members: Member[] }).members;
const field = (member: Member, key: string): Dec => dec(String(member[key]));
const pointOf = (pair: unknown): Point => {
  const [x, y] = pair as [string, string];
  return { x: dec(x), y: dec(y) };
};

/** A box as [x0, y0, x1, y1]. */
type Box = readonly [Dec, Dec, Dec, Dec];
const boxOf = (ring: readonly Point[]): Box => [
  ring.map((p) => p.x).reduce(min),
  ring.map((p) => p.y).reduce(min),
  ring.map((p) => p.x).reduce(max),
  ring.map((p) => p.y).reduce(max),
];
const overlap = (a: Box, b: Box): Dec => {
  const w = sub(min(a[2], b[2]), max(a[0], b[0]));
  const h = sub(min(a[3], b[3]), max(a[1], b[1]));
  return cmp(w, ZERO) > 0 && cmp(h, ZERO) > 0 ? mul(w, h) : ZERO;
};
const within = (inner: Box, outer: Box): boolean =>
  cmp(inner[0], outer[0]) >= 0 && cmp(inner[1], outer[1]) >= 0 && cmp(inner[2], outer[2]) <= 0 && cmp(inner[3], outer[3]) <= 0;

// --- the tests ---------------------------------------------------------------------------------

describe("S0: S-Measure's Design Decision keeps a whole record", () => {
  test("§0 and §11 name the same Interpretations, one row each, and every verdict is the refuter's word", () => {
    const text = read(DECISION);
    const defined = definedInterpretations(text);
    const rows = refuterRows(text);
    expect(defined.size, "the Decision rules its manual-measurement law as Interpretations").toBeGreaterThan(0);
    expect([...rows.keys()].sort(), "every Interpretation has exactly one refuter row, and no row names an undefined one").toEqual([...defined.keys()].sort());
    for (const [token, verdict] of rows) {
      expect(VERDICTS.has(verdict), `${token}'s verdict "${verdict}" is one of ${[...VERDICTS].join(", ")}`).toBe(true);
    }
  });

  test("if the refuter rejects the blinding reading, its Deviation from L-FRM-04 is entered", () => {
    const text = read(DECISION);
    const blinding = [...definedInterpretations(text)].find(([, title]) => title.startsWith("Blinding is measured"));
    expect(blinding, "§0 rules how blinding is measured by hand").toBeDefined();
    const verdict = refuterRows(text).get(blinding?.[0] ?? "");
    if (verdict === "REJECTED") {
      expect(read(DEVIATIONS).includes("L-FRM-04"), "a rejected blinding reading is a Deviation from L-FRM-04, entered in the same commit").toBe(true);
    } else {
      const held = /\*\*D-(?:S0-[a-z]|[0-9]{3}) \(entered only if the refuter rejects/.test(section(text, "11. Refuter record"));
      expect(held, "the held Deviation's text stands in §11 until the verdict").toBe(true);
    }
  });

  test("§3 rules each of R-UI-050's seven states", () => {
    const ruled = new Set(
      section(read(DECISION), "3. States")
        .split("\n")
        .filter((line) => line.startsWith("| "))
        .map((line) => cells(line)[0]),
    );
    for (const state of R_UI_050_STATES) expect(ruled.has(state), `§3 has a row for the ${state} state`).toBe(true);
  });

  test("every token the Decision names is one the stylesheets define, and no primitive ramp is named", () => {
    const text = read(DECISION);
    const css = readdirSync(join(ROOT, "src/ui"), { recursive: true, encoding: "utf8" })
      .filter((relative) => relative.endsWith(".css"))
      .map((relative) => read(join("src/ui", relative)))
      .join("\n");
    const defined = new Set([...css.matchAll(/(--[a-z][a-z0-9-]*)\s*:/g)].map((match) => match[1] as string));
    expect(defined.size, "the token stylesheet defines the design tokens").toBeGreaterThan(50);
    for (const match of text.matchAll(/--([a-z][a-z0-9-]*[a-z0-9])(-\*)?/g)) {
      const name = `--${match[1] as string}`;
      const family = match[2] !== undefined;
      const exists = family ? [...defined].some((token) => token.startsWith(`${name}-`)) : defined.has(name);
      expect(exists, `${name}${family ? "-*" : ""} is a token the stylesheets define`).toBe(true);
    }
    const ruled = text.slice(0, text.indexOf("\n## Changelog"));
    expect(ruled.match(/--(?:graphite|beam)-[0-9]/g) ?? [], "the Decision rules no primitive ramp position (R-UI-086)").toEqual([]);
  });
});

describe("S0: I-393's readings of J-000's ring are the committed fixture's", () => {
  const text = read(DECISION);
  const readings = ringReadings(text);
  const entities = dxfEntities(DXF);
  const model = members();
  const member = (id: string): Member => {
    const found = model.find((m) => m.id === id);
    expect(found, `model.json holds ${id}`).toBeDefined();
    return found as Member;
  };
  const sog = member("SOG@GF");
  const slabRing = polylineRing(entities, "81D");
  // Rev C's D-BLIND (W-40): the four LINEs moved onto the slab's square edges, and 2309 draws the
  // chamfer between 826 and 827 — the outline is five LINEs, closing on 81D's own points.
  const outline = lineRing(entities, ["824", "825", "826", "2309", "827"]);
  const pit = lwpolylineRing(entities, "830");

  test("the ring is the SOG's own outline: 81D is SOG@GF's polygon on S-08, and the pit 830 its lift-pit hole", () => {
    const poly = (sog["poly"] as unknown[]).map(pointOf);
    expect(slabRing.length, "81D has the SOG's five points").toBe(poly.length);
    const offset = { x: sub(slabRing[0]?.x ?? ZERO, poly[0]?.x ?? ZERO), y: sub(slabRing[0]?.y ?? ZERO, poly[0]?.y ?? ZERO) };
    const tolerance = dec("0.000001");
    slabRing.forEach((p, i) => {
      const q = poly[i] as Point;
      expect(cmp(abs(sub(sub(p.x, offset.x), q.x)), tolerance) < 0 && cmp(abs(sub(sub(p.y, offset.y), q.y)), tolerance) < 0, `81D's point ${i} is SOG@GF's, shifted onto S-08`).toBe(true);
    });
    const hole = (sog["holes"] as Array<{ kind: string; poly: unknown[] }>).find((h) => h.kind === "LIFT_PIT");
    expect(hole, "SOG@GF deducts the lift pit").toBeDefined();
    const holeRing = (hole?.poly ?? []).map(pointOf);
    expect(pit.map((p) => `${spell(sub(p.x, offset.x))},${spell(sub(p.y, offset.y))}`)).toEqual(holeRing.map((p) => `${spell(p.x)},${spell(p.y)}`));
    const least = [...slabRing].sort((a, b) => cmp(a.x, b.x) || cmp(a.y, b.y))[0] as Point;
    const key = `|${fixed(least.x, 1)},${fixed(least.y, 1)}@`;
    expect(text.includes(key), `the Decision keys J-000's ring at 81D's least point ${key}`).toBe(true);
  });

  test("the areas: 81D, the blinding outline 824–827 and 2309, their difference, and the lift pit", () => {
    const slab = shoelace(slabRing);
    const drawn = shoelace(outline);
    expect(reading(readings, "slab outline 81D, mm²")).toBe(spell(slab));
    expect(reading(readings, "blinding outline 824–827 and 2309, mm²")).toBe(spell(drawn));
    expect(reading(readings, "blinding outline outside the slab, mm²")).toBe(spell(sub(drawn, slab)));
    // TEST_AMENDED (R0 Rev C, D-BLIND, W-40): Rev B's rectangle took in 9.504 m² more than the slab;
    // Rev C's outline follows it, so the drawn blinding and 81D are one ring.
    expect(cmp(drawn, slab), "the drawn blinding outline takes in exactly the slab").toBe(0);
    expect(reading(readings, "lift pit 830, mm²")).toBe(spell(shoelace(pit)));
  });

  test("the deductions: 25 FDN columns clipped to the ring, the core walls inside the pit, and the yardstick's sums", () => {
    const poly = (sog["poly"] as unknown[]).map(pointOf);
    const box = boxOf(poly);
    // The chamfer is the only edge of SOG@GF off the box: points inside satisfy x − y + c ≥ 0, with c
    // read off the chamfer's lower vertex (x − y + c = 0 there).
    const lower = poly.find((p) => cmp(p.x, box[0]) === 0 && cmp(p.y, box[1]) > 0) as Point;
    const c = sub(lower.y, lower.x);
    const insideChamfer = (x: Dec, y: Dec): boolean => cmp(add(sub(x, y), c), ZERO) >= 0;
    const columns = model.filter((m) => m.class === "COLUMN" && m.level === "FDN");
    let meeting = 0;
    let straddling = 0;
    let clipped = ZERO;
    const outside: string[] = [];
    for (const column of columns) {
      const cx = field(column, "cx");
      const cy = field(column, "cy");
      if (Number(column["rot"]) !== 0) {
        // A rotated plan reaches at most max(b, d) · √2 / 2 < max(b, d) · 3/4 from its centre, and
        // x − y + c changes by at most that reach · √2 < reach · 3/2 over it. A centre that clears the
        // box and the chamfer by those margins holds the plan wholly inside, so it deducts b · d.
        const reach = mul(max(field(column, "b"), field(column, "d")), dec("0.75"));
        const whole = within([sub(cx, reach), sub(cy, reach), add(cx, reach), add(cy, reach)], box) && cmp(add(sub(cx, cy), c), mul(reach, dec("1.5"))) >= 0;
        expect(whole, `${column.id}, rotated, lies wholly inside the ring`).toBe(true);
        meeting += 1;
        clipped = add(clipped, mul(field(column, "b"), field(column, "d")));
        continue;
      }
      const hx = half(field(column, "sx"));
      const hy = half(field(column, "sy"));
      const plan: Box = [sub(cx, hx), sub(cy, hy), add(cx, hx), add(cy, hy)];
      const part = overlap(plan, box);
      if (cmp(part, ZERO) === 0) {
        outside.push(String(column["mark"] ?? column.id));
        continue;
      }
      for (const [x, y] of [[plan[0], plan[1]], [plan[0], plan[3]], [plan[2], plan[1]], [plan[2], plan[3]]] as const) {
        expect(insideChamfer(x, y), `${column.id}'s plan clears the chamfer, so its box clip is its ring clip`).toBe(true);
      }
      meeting += 1;
      if (cmp(part, mul(field(column, "sx"), field(column, "sy"))) < 0) straddling += 1;
      clipped = add(clipped, part);
    }
    expect(outside, "the one FDN column outside the ring is C7, the porch column").toEqual(["C7"]);
    expect(reading(readings, "FDN columns meeting the ring")).toBe(String(meeting));
    expect(reading(readings, "their plans clipped to the ring, mm²")).toBe(spell(clipped));
    expect(reading(readings, "of those columns, straddling the slab's edge")).toBe(String(straddling));

    const pitBox = boxOf((((sog["holes"] as Array<{ kind: string; poly: unknown[] }>).find((h) => h.kind === "LIFT_PIT")?.poly ?? []) as unknown[]).map(pointOf));
    const walls = model.filter((m) => m.class === "SHEAR_WALL" && m.level === "FDN");
    let wallPlan = ZERO;
    for (const wall of walls) {
      const plan: Box = [field(wall, "x0"), field(wall, "y0"), field(wall, "x1"), field(wall, "y1")];
      expect(within(plan, pitBox), `${wall.id} stands inside the lift pit 830, the core's outer face`).toBe(true);
      wallPlan = add(wallPlan, mul(sub(plan[2], plan[0]), sub(plan[3], plan[1])));
    }
    expect(reading(readings, "FDN core walls inside the pit, mm²")).toBe(spell(wallPlan));
    const yardstick = field(sog, "col_deduct");
    // TEST_AMENDED (R0 K21, W-33): the yardstick deducts only what stands on the slab's net plan — no
    // wall inside the pit it already deducted, and A4's and A5's parts in the ramp hole on RAMP@GF alone.
    expect(cmp(add(yardstick, field(member("RAMP@GF"), "col_deduct")), clipped), "the yardstick's deductions under SOG@GF and RAMP@GF are those columns, once each, and no wall").toBe(0);
    expect(reading(readings, "the yardstick's deduction under SOG@GF, mm²")).toBe(spell(yardstick));
    expect(reading(readings, "the yardstick's deduction under RAMP@GF, mm²")).toBe(spell(field(member("RAMP@GF"), "col_deduct")));
  });

  test("the hand figure is the ring less the pit and the columns at 75 mm, beside the golden's row", () => {
    const net = sub(sub(shoelace(slabRing), shoelace(pit)), dec(reading(readings, "their plans clipped to the ring, mm²")));
    const cubic = shift(mul(net, dec("75")), 9);
    expect(reading(readings, "hand figure, m³")).toBe(spell(round(cubic, 6)));
    const rows = (JSON.parse(read(GOLDEN)) as { rows: Array<Record<string, string>> }).rows;
    const golden = rows.find((row) => row["class"] === "SLAB" && row["kind"] === "BLINDING" && row["level"] === "GF");
    expect(golden, "the golden carries slab × blinding × GF").toBeDefined();
    expect(reading(readings, "golden slab × blinding × GF, m³")).toBe(golden?.["quantity"]);
  });
});
