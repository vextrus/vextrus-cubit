// The frame the S-Auth screens share (Decision § 1): the mark, the title, the body and the footer,
// in that order, in one centred column.
//
// R-UI-070 and Decision I-10: the full spark mark belongs to the unauthenticated surface and to
// nothing else, so a signed-in screen asks for the `product` surface and renders no mark. The brand
// colours are founder-fixed inside the vendored assets rather than token reads, which is why the
// light and dark marks are two files and the stylesheet's one `[data-theme]` rule chooses between
// them. Both are decoration — the heading is what names the product, and the wrapper borrows it.
import type { ReactNode } from "react";
import markDark from "../../ui/brand/vextrus-mark-dark.svg";
import markLight from "../../ui/brand/vextrus-mark.svg";
import type { StringKey } from "../../ui/strings";
import { FooterLines, type FooterLine } from "./footer";
import { AuthHeading } from "./title";

/** The mark's size in CSS pixels, stated on the elements so the column never reflows as it loads. */
const MARK_PX = 48;

/** The heading the mark's wrapper is named by — one per page, so one id is enough. */
const TITLE_ID = "s-auth-title";

/** Which surface this is: the unauthenticated one carries the mark, a product page does not. */
export type AuthSurface = "unauthenticated" | "product";

export interface AuthFrameProps {
  title: StringKey;
  caption?: StringKey;
  surface?: AuthSurface;
  footer?: readonly FooterLine[];
  children: ReactNode;
}

export function AuthFrame({ title, caption, surface = "unauthenticated", footer = [], children }: AuthFrameProps) {
  return (
    <div className="cx-auth-column" data-width={surface === "product" ? "wide" : undefined}>
      {surface === "unauthenticated" ? (
        <span className="cx-auth-mark" role="img" aria-labelledby={TITLE_ID}>
          <img className="cx-auth-mark-light" src={markLight.src} alt="" aria-hidden="true" width={MARK_PX} height={MARK_PX} />
          <img className="cx-auth-mark-dark" src={markDark.src} alt="" aria-hidden="true" width={MARK_PX} height={MARK_PX} />
        </span>
      ) : null}
      <AuthHeading title={title} caption={caption} titleId={TITLE_ID}>
        {children}
      </AuthHeading>
      <FooterLines lines={footer} />
    </div>
  );
}
