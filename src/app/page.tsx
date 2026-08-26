// The Golden Path's first checkpoint (J-000): the product's nameplate on the graphite-0 ground.
// The copy comes from the string table (C-SPINE-PLATFORM) and every value below is a token
// (R-UI-001); the ground, the heading weight and the line height are inherited from globals.css.
import { strings } from "../ui/strings";

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
    </main>
  );
}
