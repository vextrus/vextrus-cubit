// /sessions (Decision § 2): the signed-in page of the set, so it carries no mark (R-UI-070, I-10)
// and takes the wider column the list needs.
import { AuthFrame } from "../auth-frame";
import { strings } from "../../../ui/strings";
import { SessionList } from "./session-list";

// The document names the screen it is, from the table the heading reads (R-SPINE-060).
export const metadata = { title: strings.auth_sessions_title };

export default function SessionsPage() {
  return (
    <AuthFrame title="auth_sessions_title" caption="auth_sessions_caption" surface="product">
      <SessionList />
    </AuthFrame>
  );
}
