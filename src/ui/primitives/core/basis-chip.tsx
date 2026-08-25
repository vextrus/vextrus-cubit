"use client";
/**
 * R-UI-002's pair, rendered: the glyph and the label, coloured through the basis's own token. The
 * glyph is decorative to a screen reader — the label already says which basis this is — but it is
 * what carries the distinction into greyscale and colour-blindness, so it never travels alone.
 */
import type { ComponentPropsWithRef } from "react";
import { BASIS_GLYPHS, type Basis } from "./basis";
import { cx } from "./class-names";

export interface BasisChipProps extends ComponentPropsWithRef<"span"> {
  basis: Basis;
}

export function BasisChip({ basis, className, ...rest }: BasisChipProps) {
  return (
    <span {...rest} className={cx("cx-basis-chip", className)} data-testid="basis-chip" data-basis={basis}>
      <span className="cx-basis-glyph" data-testid="basis-glyph" aria-hidden="true">
        {BASIS_GLYPHS[basis]}
      </span>
      {basis}
    </span>
  );
}
