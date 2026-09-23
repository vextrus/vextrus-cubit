/**
 * S-BBS's mirrored copy is the registry's own (C-13, B-17, R-SPINE-060).
 *
 * The workspace and the issued schedule's emission live in `src/modules`, which ARCH-01 bars from
 * `src/ui/strings`, so they read their words from `src/modules/takeoff/bbs-ui/copy.ts`, a mirror of
 * `src/ui/strings/bbs.ts`. A mirror can drift, and I-534 and I-536 added words both faces now say
 * (the member count, the components of a rebar line), so this is what keeps it a mirror: every
 * sentence the module says is the registry's byte for byte, and every `bbs_…` sentence the registry
 * holds is one the module says. The registry's two keys that belong to OTHER screens' vocabularies
 * (the job pattern's step word and S-Documents' kind label) are read there and never mirrored here.
 *
 * A test may import both sides: `tests/**` is outside the layer matrix. Nothing here opens a database.
 */
import { describe, expect, test } from "vitest";
import { BBS_COPY } from "../../../src/modules/takeoff/bbs-ui/copy";
import { bbs } from "../../../src/ui/strings/bbs";

const registry = bbs as unknown as Record<string, string>;
const mirror = BBS_COPY as unknown as Record<string, string>;

/** The registry's keys this screen does not say itself: other patterns read them by key. */
const READ_ELSEWHERE = new Set(["job_step_bbs-render", "documents_kind_bbs"]);

describe("S-BBS's mirrored copy is the registry's own", () => {
  test("every mirrored sentence is the registry's value, byte for byte", () => {
    const drifted = Object.entries(mirror).filter(([key, said]) => registry[key] !== said).map(([key]) => key);
    expect(drifted, "the module says no sentence the registry does not hold in the same words").toEqual([]);
  });

  test("every sentence the registry holds for this screen is mirrored", () => {
    expect(
      Object.keys(mirror).sort(),
      "the two tables carry the same keys, so neither can gain a sentence the other never hears",
    ).toEqual(Object.keys(registry).filter((key) => !READ_ELSEWHERE.has(key)).sort());
  });
});
