// /sessions (Decision § 2): the signed-in page of the set, so it carries no mark (R-UI-070, I-10)
// and takes the wider column the list needs.
import { AuthFrame } from "../auth-frame";
import { strings } from "../../../ui/strings";
import { SessionList } from "./session-list";

// The document names the screen it is, from the table the heading reads (R-SPINE-060).
export const metadata = { title: strings.auth_sessions_title };

// The caption belongs to the list, not to the frame: it says "Everywhere you are signed in", which
// is a claim about a list, and the SIGNED_OUT answer stands in place of the list (Decision § 3). Left
// on the frame it would sit one line above a refusal saying the session has ended — the page
// contradicting itself in two adjacent lines. `SessionList` renders it with the legs it is true of.
export default function SessionsPage() {
  return (
    <AuthFrame title="auth_sessions_title" surface="product">
      <SessionList />
    </AuthFrame>
  );
}
