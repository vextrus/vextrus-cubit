/**
 * The gallery's sample refusals, spelled once (B-17, ARCH-02). Every refusal the catalogue mounts —
 * the RefusalState matrix and the denied shell frame — is built from this table, so the sampled copy
 * has one home in `src/ui` rather than one per sample.
 *
 * ARCH-01 keeps the binding out of this file: `src/ui` may not value-import `src/core`, so the
 * register's entries cannot be read here and the sentences are held as data with `RefusalEntry`
 * arriving as a type. The one guard that these are the registered entries — code, message, remedy
 * and severity, compared against `REFUSALS` — lives in the acceptance under `tests/`, which may
 * lawfully reach both layers. It is the single drift guard; no second comparison is written.
 *
 * The surface is the caller's, not the sample's: R-UI-020 renders the same refusal on an inline
 * field, a banner or inside a dialog, and the gallery shows each.
 */
import type { RefusalEntry, RefusalSeverity, RefusalSurface } from "../../core/errors";

/** The registered codes the gallery samples: one per severity, plus the shell frame's denial. */
export type SampleRefusalCode = "PRECISION_NOT_APPLIED" | "RATE_LIMITED" | "ACT_CHANGES_NOTHING" | "PERMISSION_NOT_HELD";

/** What a sample carries of a registered entry: everything except the surface it is rendered on. */
type SampleRefusal = Pick<RefusalEntry, "code" | "message" | "remedy" | "severity">;

export const SAMPLE_REFUSALS: Readonly<Record<SampleRefusalCode, SampleRefusal>> = Object.freeze({
  PRECISION_NOT_APPLIED: Object.freeze({
    code: "PRECISION_NOT_APPLIED",
    message: "The value is not at the exact precision this document requires.",
    remedy: "Enter the value at the stated precision — nothing is rounded or padded on your behalf.",
    severity: "error",
  }),
  RATE_LIMITED: Object.freeze({
    code: "RATE_LIMITED",
    message: "Too many attempts in a short time, so this one was not tried.",
    remedy: "Wait a minute, then try again.",
    severity: "warning",
  }),
  ACT_CHANGES_NOTHING: Object.freeze({
    code: "ACT_CHANGES_NOTHING",
    message: "This action would leave the project exactly as it is, so nothing was recorded.",
    remedy: "Choose a change that moves something — what you asked for is already the case.",
    severity: "info",
  }),
  PERMISSION_NOT_HELD: Object.freeze({
    code: "PERMISSION_NOT_HELD",
    message: "Your roles on this project do not carry the permission this action needs.",
    remedy: "Ask a principal of the project to give you a role that carries it.",
    severity: "error",
  }),
});

/**
 * Which registered code stands for each severity in the gallery (Decision I-18). The map is total
 * over `RefusalSeverity`, so a severity the register grows is a compile error here rather than a
 * severity the gallery quietly stops showing.
 */
export const SAMPLE_REFUSAL_BY_SEVERITY: Readonly<Record<RefusalSeverity, SampleRefusalCode>> = Object.freeze({
  error: "PRECISION_NOT_APPLIED",
  warning: "RATE_LIMITED",
  info: "ACT_CHANGES_NOTHING",
});

/** One sample as a whole entry, rendered on the surface the caller is demonstrating. */
export function sampleRefusal(code: SampleRefusalCode, surface: RefusalSurface): RefusalEntry {
  return { ...SAMPLE_REFUSALS[code], surface };
}
