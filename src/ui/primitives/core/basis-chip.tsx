"use client";
/**
 * R-UI-002's pair, rendered: the glyph and the label, coloured through the basis's own token. The
 * glyph is decorative to a screen reader — the label already says which basis this is — but it is
 * what carries the distinction into greyscale and colour-blindness, so it never travels alone.
 *
 * THE LABEL IS A WORD, NOT THE ENUM (Design Direction 00 §6, §7 C11; amended by v22 U2, 2026-09-12).
 * This chip used to render `{basis}` as a bare text node, so `TRANSCRIBED` stood on the face of the
 * screen once per row. It is the single largest craft defect left in the product, because it is not
 * one screen's: the chip appears on S-Takeoff, on S-Coverage, in the viewer's Trace block and — in
 * M3 — on all four grids built from §3.2's template, and NO grid screen in the product could score
 * above 3 on C6 while it stood. The register found it and correctly refused to re-word it at the
 * call site: a consumer that spells a shipped primitive's copy for itself is the B-17 defect this
 * primitive exists to prevent.
 *
 * The fix is reuse, not a second rule: `EnumLabel` already says a model value in words and keeps the
 * raw value in the DOM under a technical disclosure, so an engineer and a suite matching on the enum
 * both still find it. `SCREAMING_SNAKE` → "Transcribed" is mechanical there and stays mechanical
 * here; a basis that ever needs different words hands `EnumLabel` a `label`, as any other value does.
 */
import type { ComponentPropsWithRef } from "react";
import { BASIS_GLYPHS, type Basis } from "./basis";
import { cx } from "./class-names";
import { EnumLabel } from "./enum-label";
import { TESTIDS } from "@/ui/testids";

export interface BasisChipProps extends ComponentPropsWithRef<"span"> {
  basis: Basis;
}

export function BasisChip({ basis, className, ...rest }: BasisChipProps) {
  return (
    <span {...rest} className={cx("cx-basis-chip", className)} data-testid={TESTIDS.basis.chip} data-basis={basis}>
      <span className="cx-basis-glyph" data-testid={TESTIDS.basis.glyph} aria-hidden="true">
        {BASIS_GLYPHS[basis]}
      </span>
      <EnumLabel className="cx-basis-word" value={basis} />
    </span>
  );
}
