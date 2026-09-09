// The composition root for SEAM-GATE's job kind (ARCH-01), and the one lawful caller of the gate.
//
// "The gate is the sole writer of quantity lines and rail observations (L-MEA-08)": nothing under
// `src/modules/**` or `src/app/**` may import `src/core/gate` at all, which leaves exactly one place
// the run and the gate can meet — here. The measurement is written in src/modules/takeoff, the rail
// roster is that module's, the gate is core's, and the worker is the layer that may hold them all
// (ARCH-02, B-17, riskNotes (2)).
import { evaluateOffers } from "../../core/gate";
import { registerJobHandler } from "../../core/jobs";
import { MEASURE_KIND } from "../../modules/takeoff/measure";
import { runMeasureJob, type MeasureDeps } from "../../modules/takeoff/measure/job";
import { RAILS } from "../../modules/takeoff/rails";

/**
 * What a measurement runs against in production: the rails the product ships, and the real gate.
 *
 * It is published rather than inlined because "the production wiring" is a fact worth being able to
 * name — the handler below and anything that has to run a measurement outside a worker read the same
 * one, so the two cannot drift (ARCH-02).
 */
export function measureDeps(): MeasureDeps {
  return { rails: RAILS, gate: evaluateOffers };
}

/** Say which function does a `measure` job's work, and what it reaches the gate and the rails with. */
export function registerMeasureHandler(): void {
  registerJobHandler(MEASURE_KIND, async (payload, progress) => {
    await runMeasureJob(payload, progress, measureDeps());
  });
}
