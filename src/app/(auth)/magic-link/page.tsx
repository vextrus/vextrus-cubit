// /magic-link (Decision § 2): the same route asks for the link and spends it, because the mail sends
// the person back to where they started.
import { AuthFrame } from "../auth-frame";
import type { FooterLine } from "../footer";
import { AUTH_ROUTES, tokenFrom } from "../routes";
import { TokenPanel } from "../token-panel";
import { strings } from "../../../ui/strings";
import { MagicLinkForm } from "./magic-link-form";

// The document names the screen it is, from the table the heading reads (R-SPINE-060).
export const metadata = { title: strings.auth_magic_link_title };

const FOOTER: readonly FooterLine[] = [{ label: "auth_magic_link_footer_link", href: AUTH_ROUTES.signIn }];

export default async function MagicLinkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = tokenFrom(await searchParams);
  return (
    <AuthFrame title="auth_magic_link_title" footer={FOOTER}>
      {token === null ? (
        <MagicLinkForm />
      ) : (
        <TokenPanel route={AUTH_ROUTES.magicLink} token={token} procedure="consumeMagicLink" outcome={{ goTo: AUTH_ROUTES.home }} />
      )}
    </AuthFrame>
  );
}
