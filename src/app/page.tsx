// The Golden Path's first checkpoint (J-000): the product's nameplate on the graphite-0 ground.
// The copy comes from the string table (C-SPINE-PLATFORM) and every value below is a token
// (R-UI-001); the ground, the heading weight and the line height are inherited from globals.css.
import "../ui/primitives/core/reticle.css";
import { strings } from "../ui/strings";

// R-UI-031: the sign-in and sign-up screens are reachable by a visible control, never by a typed
// URL alone. The nameplate carries exactly those two — the landmark owes a state for anything more.
const DOORS = [
  { href: "/sign-in", label: strings.home_sign_in },
  { href: "/sign-up", label: strings.home_sign_up },
] as const;

export default function HomePage() {
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
        {DOORS.map((door) => (
          <a
            className="cx-reticle"
            key={door.href}
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
