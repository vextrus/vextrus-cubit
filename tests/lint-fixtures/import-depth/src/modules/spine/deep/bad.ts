// ARCH-01: three `../` segments from `src/modules/spine/deep/` land on `src/` — the specifier is
// back inside the layered tree with no layer named. Every shape the specifier reader offers is a
// way to reach a module, so every shape is a payload here (Q-01).
import { fault } from "../../../core/errors"; // RECORDED REASON ARCH-01
import type { Act } from "../../../core/acts"; // RECORDED REASON ARCH-01

export { formatted } from "../../../core/format"; // RECORDED REASON ARCH-01
export * from "../../../core/sheets"; // RECORDED REASON ARCH-01

const jobs = require("../../../../src/core/jobs"); // RECORDED REASON ARCH-01

export const marker = () => import("../../../core/faults/refusal-marker"); // RECORDED REASON ARCH-01
export const usedFault = fault;
export const usedJobs = jobs;
export type UsedAct = Act;
