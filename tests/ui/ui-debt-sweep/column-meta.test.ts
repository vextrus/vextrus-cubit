/**
 * AC-2(d): the gallery's sample columns type-check instead of being cast.
 *
 * Two halves, because the criterion has two: the cast is gone from the catalogue's code, and the
 * table's column meta is a checked shape rather than the empty interface TanStack ships. The second
 * is graded by `tsc --noEmit` (this file is on a path the types lane compiles) — an unaugmented
 * `ColumnMeta` accepts `{ align: "left" }`, so the negative below is the assertion that fails until
 * the module augmentation lands, and no error-suppression directive is used to write it (Q-08).
 */
import type { ColumnMeta } from "@tanstack/react-table";
import { describe, expect, test } from "vitest";
import { codeOf } from "../../../src/core/__tests__/support/read-source";
import type { Assignable, Expect, Not } from "./support/type-assertions";

const ENTRIES_MODULE = "src/ui/gallery-derivation/entries.tsx";

/** The meta the sample's numeric column carries: alignment, filtering and inline editing. */
export type SampleColumnMetaIsAccepted = Expect<Assignable<{ align: "right"; filterable: true; editable: true }, ColumnMeta<unknown, unknown>>>;

/** A column fact the table does not define is a compile error, which is what the cast was hiding. */
export type UnknownColumnMetaIsRefused = Expect<Not<Assignable<{ align: "left" }, ColumnMeta<unknown, unknown>>>>;

describe("AC-2d: the sample column definitions are checked, not cast", () => {
  test("AC-2d: entries.tsx casts neither its column definitions nor its meta", () => {
    const code = codeOf(ENTRIES_MODULE, "AC-2(d) judges how the catalogue types its sample columns");
    expect(code, "a cast to ColumnDef defeats the type-checking of the column set it declares").not.toContain(" as ColumnDef");
    expect(code, "a double cast defeats every check between the two types it steps over").not.toContain(" as unknown as");
  });
});
