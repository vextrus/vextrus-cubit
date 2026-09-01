// L-MEA-04: kind → authoritative discipline. One of the two total maps over `Kind`, and independent
// of the other by construction — this file reads the kinds and nothing else, so a discipline can
// never be inferred from an algebra or the reverse.
//
// The discipline is *authoritative*, not merely interested: it names whose drawing the quantity is
// taken from when two disciplines show the same thing and disagree. A wall's brickwork is the
// architect's, the column it butts into is the engineer's, and the conduit buried in either belongs
// to services — which is why the map is per kind and not per element class.
import { type Kind } from "./kinds";

/** The disciplines a takeoff is authored by. */
export type Discipline = "civil" | "structural" | "architectural" | "building-services";

/** The authoritative discipline of every kind. Total over `Kind`: a missing key is a `tsc` failure. */
export const KIND_DISCIPLINE: Readonly<Record<Kind, Discipline>> = Object.freeze({
  excavation: "civil",
  backfilling: "civil",
  "sand-filling": "civil",
  "brick-soling": "civil",
  "lean-concrete": "structural",
  "concrete-casting": "structural",
  reinforcement: "structural",
  formwork: "structural",
  "structural-steel": "structural",
  brickwork: "architectural",
  plastering: "architectural",
  tiling: "architectural",
  painting: "architectural",
  waterproofing: "architectural",
  "false-ceiling": "architectural",
  skirting: "architectural",
  railing: "architectural",
  pipework: "building-services",
  "sanitary-ware": "building-services",
  "electrical-point": "building-services",
} satisfies Record<Kind, Discipline>);
