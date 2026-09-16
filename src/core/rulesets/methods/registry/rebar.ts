// The REBAR method area: L-MEA-01's pairs for reinforcement, and the code each is computed by.
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.
//
// The shard records its five pairs as a LIST — one entry per method, each naming the file that
// implements it — and this file keys them for the roster the registry enumerates. The list is the
// record; the key is how a roster is read. Neither is a second spelling of the other: the entry is
// carried through whole, so the manifest's digest and the roster's key move together (L-MEA-01).

import rebarShard from "../rebar/rebar.methods.json" with { type: "json" };
import { CUTTING_LENGTH_BS8666 } from "../rebar/bs8666";
import { DETAILING_BNBC2020_BD } from "../rebar/detailing-bnbc2020-bd";
import { REBAR_MASS_FORMULA, REBAR_MASS_METHOD } from "../rebar/mass";
import { REBAR_STOCK } from "../rebar/stock";
import { REBAR_SYNTHESIS } from "../rebar/synthesis";
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

/** The formula a rebar line publishes: the net and the laps beside it (AM-03(a)). */
export const MASS_METHOD: MethodPair = REBAR_MASS_METHOD;

/** The shard, keyed the way the roster reads one: `<ruleId>@<version>` per recorded entry. */
const RECORDED: MethodShard = Object.freeze({
  methods: Object.freeze(
    Object.fromEntries(
      rebarShard.methods.map((entry) => [methodKey(entry), Object.freeze({ ruleId: entry.ruleId, version: entry.version, law: entry.law, module: entry.implementation })] as const),
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
    [methodKey(MASS_METHOD)]: REBAR_MASS_FORMULA,
  }),
});
