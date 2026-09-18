// R-UI-050's matrix for the project settings FRAME (sub-navigation § 2), in the one enumerable place
// a suite reflects over (B-19). The frame reads nothing and calls no procedure, so most of its cells
// are delegations to the area standing inside it — and each one says so with its reason.
import type { ShellStateCell, ShellStateName } from "@/ui/shell/states";

/** The frame's own home, spelled once. */
const FRAME = "src/app/(app)/t/[tenant]/p/[project]/settings/layout.tsx";

export const PROJECT_SETTINGS_NAV_STATES: Readonly<Record<ShellStateName, ShellStateCell>> = {
  loading: {
    declared: "delegated",
    to: "the area's own loading.tsx, in the content slot",
    why: "the nav is static chrome built from a compile-time roster and renders with the layout; while a child area loads it stands complete, with the row being navigated to already current. A skeleton for four known words would be theatre",
  },
  empty: {
    declared: "impossible",
    why: "PROJECT_SETTINGS_AREAS is a constant of four entries — a roster of none is a compile error, not a render",
  },
  // The promise not yet kept, rendered: an area the product has named and not built stands in its
  // place, disabled, with its reason one hover or one focus away (I-259).
  partial: { declared: "rendered", by: FRAME, testId: "settings-area" },
  error: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "a fault inside a child area surfaces that segment's boundary inside this layout's content slot, so the nav survives it and a reader can leave the broken area by clicking another one",
  },
  refusal: {
    declared: "impossible",
    why: "the layout reads nothing and calls no procedure, so it can be refused nothing; a child's refusal renders in that child's own in-place slot",
  },
  offline: {
    declared: "delegated",
    to: "src/app/error.tsx",
    why: "I-20: a failed navigation surfaces the error path; the nav invents no banner and no row goes grey for the connection",
  },
  permissionDenied: {
    declared: "delegated",
    to: "src/app/(app)/t/[tenant]/p/[project]/layout.tsx",
    why: "the project's choke point answers before this layout mounts. The nav never hides an area from a reader who lacks a permission (R-SPINE-006): every area is listed to everyone who can see the project, and the screen behind it answers in place",
  },
};
