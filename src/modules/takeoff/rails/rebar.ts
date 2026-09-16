// The REBAR area's rails, by the quantity kind each measures (AM-11, L-MEA-08).
//
// One kind, one rail: `rcc.rebar` is measured by the reinforcement rail and by nothing else. The
// barrel `./index.ts` spreads this roster in — a new area is one spread line there and one file
// here, with no shared roster to edit (B-19).
import type { RailRoster } from "./law";
import { rebarRail } from "@/modules/takeoff/rebar";

/** The rails this area publishes, keyed by quantity kind. */
export const REBAR_RAILS: RailRoster = Object.freeze({
  "rcc.rebar": rebarRail,
});
