// The FOUNDATIONS method area: L-FRM-02's and L-FRM-04's pairs for a footing, a pile cap and a pile,
// L-MEA-09's pairs for a pile cap and its blinding once the piles have taken what they own of them,
// and the code each is computed by.
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.

import { BLINDING_FORMULA, BLINDING_METHOD } from "../foundations/blinding";
import {
  FOUNDATION_PRISM_POLY_FORMULA,
  FOUNDATION_PRISM_POLY_METHOD,
  FOUNDATION_PRISM_RECT_FORMULA,
  FOUNDATION_PRISM_RECT_METHOD,
  PILE_CONCRETE_FORMULA,
  PILE_CONCRETE_METHOD,
} from "../foundations/concrete";
import { EXCAVATION_FORMULA, EXCAVATION_METHOD } from "../foundations/earthwork";
import foundationsShard from "../foundations/foundations.methods.json" with { type: "json" };
import {
  FOUNDATION_FORMWORK_POLY_FORMULA,
  FOUNDATION_FORMWORK_POLY_METHOD,
  FOUNDATION_FORMWORK_RECT_FORMULA,
  FOUNDATION_FORMWORK_RECT_METHOD,
} from "../foundations/formwork";
import {
  BLINDING_OVER_PILES_FORMULA,
  BLINDING_OVER_PILES_METHOD,
  PILE_CAP_FORMWORK_POLY_RECESS_FORMULA,
  PILE_CAP_FORMWORK_POLY_RECESS_METHOD,
  PILE_CAP_FORMWORK_RECT_RECESS_FORMULA,
  PILE_CAP_FORMWORK_RECT_RECESS_METHOD,
  PILE_CAP_PRISM_POLY_FORMULA,
  PILE_CAP_PRISM_POLY_METHOD,
  PILE_CAP_PRISM_POLY_RECESS_FORMULA,
  PILE_CAP_PRISM_POLY_RECESS_METHOD,
  PILE_CAP_PRISM_RECT_FORMULA,
  PILE_CAP_PRISM_RECT_METHOD,
  PILE_CAP_PRISM_RECT_RECESS_FORMULA,
  PILE_CAP_PRISM_RECT_RECESS_METHOD,
} from "../foundations/owned";
import { PILE_COUNT_FORMULA, PILE_COUNT_METHOD, PILE_LENGTH_FORMULA, PILE_LENGTH_METHOD } from "../foundations/piling";
import { methodKey, type MethodArea } from "./area";

/** This area's shards and the implementations for the pairs they record. */
export const FOUNDATIONS_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([foundationsShard]),
  implementations: Object.freeze({
    [methodKey(FOUNDATION_PRISM_RECT_METHOD)]: FOUNDATION_PRISM_RECT_FORMULA,
    [methodKey(FOUNDATION_PRISM_POLY_METHOD)]: FOUNDATION_PRISM_POLY_FORMULA,
    [methodKey(PILE_CONCRETE_METHOD)]: PILE_CONCRETE_FORMULA,
    [methodKey(PILE_COUNT_METHOD)]: PILE_COUNT_FORMULA,
    [methodKey(PILE_LENGTH_METHOD)]: PILE_LENGTH_FORMULA,
    [methodKey(EXCAVATION_METHOD)]: EXCAVATION_FORMULA,
    [methodKey(BLINDING_METHOD)]: BLINDING_FORMULA,
    [methodKey(FOUNDATION_FORMWORK_RECT_METHOD)]: FOUNDATION_FORMWORK_RECT_FORMULA,
    [methodKey(FOUNDATION_FORMWORK_POLY_METHOD)]: FOUNDATION_FORMWORK_POLY_FORMULA,
    // L-MEA-09's pile › pile cap, and the recess a cap is cast around (I-544, I-545,
    // I-546): rules of their own, never versions of the prisms above, which a footing shares.
    [methodKey(PILE_CAP_PRISM_RECT_METHOD)]: PILE_CAP_PRISM_RECT_FORMULA,
    [methodKey(PILE_CAP_PRISM_POLY_METHOD)]: PILE_CAP_PRISM_POLY_FORMULA,
    [methodKey(PILE_CAP_PRISM_RECT_RECESS_METHOD)]: PILE_CAP_PRISM_RECT_RECESS_FORMULA,
    [methodKey(PILE_CAP_PRISM_POLY_RECESS_METHOD)]: PILE_CAP_PRISM_POLY_RECESS_FORMULA,
    [methodKey(PILE_CAP_FORMWORK_RECT_RECESS_METHOD)]: PILE_CAP_FORMWORK_RECT_RECESS_FORMULA,
    [methodKey(PILE_CAP_FORMWORK_POLY_RECESS_METHOD)]: PILE_CAP_FORMWORK_POLY_RECESS_FORMULA,
    [methodKey(BLINDING_OVER_PILES_METHOD)]: BLINDING_OVER_PILES_FORMULA,
  }),
});
