// The REBAR method area: L-MEA-01's pairs for reinforcement, and the code each is computed by.
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.
//
// The shard records its six pairs as a LIST — one entry per method, each naming the file that
// implements it under `module`, the one spelling every shard uses for that path — and this file keys
// them for the roster the registry enumerates. The list is the record; the key is how a roster is
// read. Neither is a second spelling of the other: the entry is carried through whole, so the
// manifest's digest and the roster's key move together (L-MEA-01).
//
// The synthesis stands at two versions (R6b): @1, which every edition up to 2027.05 cites, and @2,
// which derives a column's ties under D-003 and binds a stated lap outside the grade and mix contest,
// and which the platform edition 2027.06 (OPEN-4) puts in force.
// Both are computed by the tree; which one an edition puts in force is the seed's explicit selection
// (`IN_FORCE_VERSIONS`, `src/core/rulesets/seed`), never the order the shard lists them in.

import rebarShard from "../rebar/rebar.methods.json" with { type: "json" };
import { CUTTING_LENGTH_BS8666 } from "../rebar/bs8666";
import { DETAILING_BNBC2020_BD } from "../rebar/detailing-bnbc2020-bd";
import { REBAR_MASS_FORMULA, REBAR_MASS_METHOD } from "../rebar/mass";
import { REBAR_STOCK } from "../rebar/stock";
import { REBAR_SYNTHESIS } from "../rebar/synthesis";
import { REBAR_SYNTHESIS_V2 } from "../rebar/synthesis-v2";
import { methodKey, type MethodArea, type MethodShard } from "./area";
import type { MethodPair } from "../../editions/content";

/** The detailing edition itself, as a pair: the name is the rule, the edition version the version. */
export const DETAILING_EDITION_METHOD: MethodPair = Object.freeze({ ruleId: DETAILING_BNBC2020_BD.ruleId, version: DETAILING_BNBC2020_BD.version });

/** BS 8666's cutting lengths (AM-03(c), AM-03(d)). */
export const CUTTING_LENGTH_METHOD: MethodPair = Object.freeze({ ruleId: CUTTING_LENGTH_BS8666.ruleId, version: CUTTING_LENGTH_BS8666.version });

/** The stock bar, its splits and the cutting-stock packing (L-FRM-05, R-TO-032). */
export const STOCK_METHOD: MethodPair = Object.freeze({ ruleId: REBAR_STOCK.ruleId, version: REBAR_STOCK.version });

/** What bars a member class holds, given what its schedule states (R-TO-032). */
export const SYNTHESIS_METHOD: MethodPair = Object.freeze({ ruleId: REBAR_SYNTHESIS.ruleId, version: REBAR_SYNTHESIS.version });

/** The same rule at version 2: a column's ties derived under D-003, and R2's stated lap (R6b). */
export const SYNTHESIS_V2_METHOD: MethodPair = Object.freeze({ ruleId: REBAR_SYNTHESIS_V2.ruleId, version: REBAR_SYNTHESIS_V2.version });

/** The formula a rebar line publishes: the net and the laps beside it (AM-03(a)). */
export const MASS_METHOD: MethodPair = REBAR_MASS_METHOD;

/** The shard, keyed the way the roster reads one: `<ruleId>@<version>` per recorded entry. */
const RECORDED: MethodShard = Object.freeze({
  methods: Object.freeze(
    Object.fromEntries(
      rebarShard.methods.map((entry) => [methodKey(entry), Object.freeze({ ruleId: entry.ruleId, version: entry.version, law: entry.law, module: entry.module })] as const),
    ),
  ),
  digest: rebarShard.digest,
});

/** This area's shards and the implementations for the pairs they record. */
export const REBAR_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([RECORDED]),
  implementations: Object.freeze({
    [methodKey(DETAILING_EDITION_METHOD)]: DETAILING_BNBC2020_BD,
    [methodKey(CUTTING_LENGTH_METHOD)]: CUTTING_LENGTH_BS8666,
    [methodKey(STOCK_METHOD)]: REBAR_STOCK,
    [methodKey(SYNTHESIS_METHOD)]: REBAR_SYNTHESIS,
    [methodKey(SYNTHESIS_V2_METHOD)]: REBAR_SYNTHESIS_V2,
    [methodKey(MASS_METHOD)]: REBAR_MASS_FORMULA,
  }),
});
