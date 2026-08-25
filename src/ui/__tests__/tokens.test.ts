/**
 * Superseded entry point. The token acceptance suite lives beside the module it judges —
 * R-UI-001 puts the generated stylesheet and its drift test next to `src/ui/tokens.ts` — and the
 * unit lane now collects it there directly. This file re-registers that suite and holds no
 * assertions of its own; it should be removed, and nothing may come to depend on this path.
 */
import "../tokens.test";
