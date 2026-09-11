"use client";
/**
 * The one home of what a Datum icon IS (B-17, Design Direction 00 §1 "Iconography"): a 24-unit
 * square traced in `currentColor` at a 1.5 px stroke, painted at one of the three icon sizes the
 * layout tokens name. Nothing here is fetched, bundled from a package, or generated: the set is
 * vendored as source (B-24), and `lucide-react` is NOT a dependency of this tree and must not
 * become one — see `LICENSE-lucide.txt` beside this file for the licence and the provenance.
 *
 * An icon is decorative by default. A tool button says what it is through its tooltip and its
 * accessible name (R-UI-012), so the glyph itself is hidden from the accessibility tree unless a
 * consumer gives it a `title` — the one case where the glyph IS the name.
 */
import type { ReactNode, SVGProps } from "react";

/** The three sizes the layout tokens carry (§4.2): 14, 16, 20 — nothing else is an icon size. */
export type IconSize = "sm" | "md" | "lg";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: IconSize;
  /** The name this glyph carries when it is the only thing saying what a control does (Q-11). */
  title?: string;
}

/** The geometry every glyph in the set is traced in — stated once, so no glyph can drift from it. */
const BOX = "0 0 24 24";

/**
 * A glyph component from its traced geometry. The factory exists so the 34 glyphs state their
 * PATHS and nothing else: one wrapper, one stroke width, one box, one accessibility answer.
 */
export function createIcon(name: string, geometry: ReactNode): (props: IconProps) => ReactNode {
  function Icon({ size = "md", title, className, ...rest }: IconProps): ReactNode {
    return (
      <svg
        {...rest}
        className={className === undefined ? "cx-icon" : `cx-icon ${className}`}
        data-size={size}
        data-icon={name}
        viewBox={BOX}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        role={title === undefined ? undefined : "img"}
        aria-hidden={title === undefined ? true : undefined}
        aria-label={title}
        focusable="false"
      >
        {geometry}
      </svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}
