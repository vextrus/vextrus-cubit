// The Golden Path's first checkpoint (J-000): the product's nameplate on the graphite-0 ground.
// The copy comes from the string table (C-SPINE-PLATFORM) and every value below is a token
// (R-UI-001); the ground, the heading weight and the line height are inherited from globals.css.
import "../ui/primitives/core/reticle.css";
import { presentedSessionToken } from "../server/shell/session";
import { workspaceFor } from "../server/shell/workspace";
import { strings } from "../ui/strings";

// R-UI-031: the sign-in and sign-up screens are reachable by a visible control, never by a typed
// URL alone. The nameplate carries exactly those two — the landmark owes a state for anything more.
interface HomeDoor {
  href: string;
  label: string;
  testId?: string;
}

const DOORS: readonly HomeDoor[] = [
  { href: "/sign-in", label: strings.home_sign_in },
  { href: "/sign-up", label: strings.home_sign_up },
];

/**
 * The nameplate is one screen with two branches. A visitor holding a workspace is offered the way
 * into it — a link, so the address the browser is at stays `/` — and the auth doors go, because
 * they are the remedy for not being signed in and this visitor already is.
 */
export default async function HomePage() {
  const workspace = await workspaceFor(await presentedSessionToken());
  const doors: readonly HomeDoor[] =
    workspace === null ? DOORS : [{ href: `/t/${workspace.tenantId}`, label: strings.shell_home_workspace_door, testId: "root-home-workspace-door" }];
  return (
    <main
      data-testid="root-home-main"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        padding: "var(--space-5)",
        textAlign: "center",
      }}
    >
      <h1 data-testid="root-home-heading" style={{ fontSize: "var(--text-32)", margin: 0 }}>
        {strings.app_title}
      </h1>
      <p data-testid="root-home-tagline" style={{ fontSize: "var(--text-16)", color: "var(--graphite-700)", margin: 0 }}>
        {strings.home_tagline}
      </p>
      <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-3)" }}>
        {doors.map((door) => (
          <a
            className="cx-reticle"
            key={door.href}
            data-testid={door.testId}
            href={door.href}
            style={{
              fontSize: "var(--text-14)",
              fontWeight: "var(--weight-body-medium)",
              color: "var(--beam-600)",
              textDecoration: "underline",
            }}
          >
            {door.label}
          </a>
        ))}
      </div>
    </main>
  );
}
