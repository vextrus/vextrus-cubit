// The frame the S-Auth screens share (Decision § 1, Design Direction 00 §3.7): the spark mark on
// the datum line, one card under it, and one line of mono readout at the foot — in that order, in
// one centred column, on the dark ground the product is now grounded in.
//
// R-UI-070 and Decision I-10: the full spark mark belongs to the unauthenticated surface and to
// nothing else, so a signed-in screen asks for the `product` surface and renders no mark. The brand
// colours are founder-fixed inside the vendored assets rather than token reads, which is why the
// light and dark marks are two files and the stylesheet's one `[data-theme]` rule chooses between
// them. Both are decoration, and so is the wrapper that holds them: a mark labelled by the page's
// own heading says the product's name twice to a reader moving by landmark and heading, once as an
// image and once as the `<h1>` it borrowed the words from. The heading alone names the page (I-10).
import type { ReactNode } from "react";
import { Separator } from "../../ui/primitives/core";
import markDark from "../../ui/brand/vextrus-mark-dark.svg";
import markLight from "../../ui/brand/vextrus-mark.svg";
import { strings, type StringKey } from "../../ui/strings";
import { FooterLines, type FooterLine } from "./footer";
import { AuthHeading, AuthLive, StatusOverline } from "./live";
import type { AuthRoute } from "./routes";

/** The mark's size in CSS pixels, stated on the elements so the column never reflows as it loads. */
const MARK_PX = 40;

/** The heading the mark's wrapper is named by — one per page, so one id is enough. */
const TITLE_ID = "s-auth-title";

/** Which surface this is: the unauthenticated one carries the mark, a product page does not. */
export type AuthSurface = "unauthenticated" | "product";

export interface AuthFrameProps {
  title: StringKey;
  caption?: StringKey;
  surface?: AuthSurface;
  footer?: readonly FooterLine[];
  /** Where the person is standing, for the foot readout's first cell. */
  route?: AuthRoute;
  children: ReactNode;
}

export function AuthFrame({ title, caption, surface = "unauthenticated", footer = [], route, children }: AuthFrameProps) {
  return (
    <AuthLive wide={surface === "product"}>
      {surface === "unauthenticated" ? (
        <span className="cx-auth-mark" aria-hidden="true">
          <img className="cx-auth-mark-light" src={markLight.src} alt="" aria-hidden="true" width={MARK_PX} height={MARK_PX} />
          <img className="cx-auth-mark-dark" src={markDark.src} alt="" aria-hidden="true" width={MARK_PX} height={MARK_PX} />
        </span>
      ) : null}
      {/* The card: everything being asked, inside one hairline. The ways on from this door sit under
          a separator rather than loose under the card — one primary above the line, navigation
          below it (§3.7). */}
      <section className="cx-auth-card" aria-labelledby={TITLE_ID}>
        <AuthHeading title={title} titleId={TITLE_ID} />
        {caption === undefined ? null : <p className="cx-auth-caption">{strings[caption]}</p>}
        {children}
        {footer.length === 0 ? null : <Separator />}
        <FooterLines lines={footer} />
      </section>
      <StatusOverline route={route} />
    </AuthLive>
  );
}
