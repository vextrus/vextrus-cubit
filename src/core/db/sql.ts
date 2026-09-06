// SEAM-TENANT: the two driver-level spellings the seam's modules share. A closed roster rendered as
// the SQL fragment a CHECK compares against, and the parameter list shape the driver takes. Each is
// written once here rather than restated in the schema, the seam and the jobs store, because two
// spellings of one fragment are two lists that can drift apart (B-17, ARCH-02).
//
// Nothing here is public: the barrel re-exports the seam's surface, and neither of these is part of
// it — they are how the modules beside this one speak to the driver, not what a caller asks for.
import type postgres from "postgres";

/** A closed roster as the SQL fragment a CHECK compares against — the one spelling of that list. */
export const closedList = (roster: readonly string[]): string => roster.map((member) => `'${member}'`).join(", ");

/** The parameter list shape the driver takes; the seam's own values are strings. */
export type DriverParams = NonNullable<Parameters<postgres.Sql["unsafe"]>[1]>;
