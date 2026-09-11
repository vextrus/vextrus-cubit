"use client";
/**
 * The vendored glyph set (Design Direction 00 §1 "Iconography", §3's template tables): every icon
 * the toolbars, the chrome and the states name, traced by hand in the Lucide idiom — a 24-unit
 * box, a 1.5 px `currentColor` stroke, round caps and joins, no fill but where a dot IS the mark.
 *
 * No runtime dependency backs this file. `lucide-react` is not installed and may not be (AM-08);
 * the shapes are restated from the upstream geometry rather than copied out of a package, and the
 * licence and the provenance of every glyph are recorded in `LICENSE-lucide.txt` beside it.
 *
 * The names are the ones §3 uses at the toolbar, not the upstream file names, so a reader of the
 * direction finds the glyph it asks for: `IconSelect`, `IconPan`, `IconLinear`, and so on.
 */
import { createIcon } from "./icon-base";

/* --------------------------------------------------------------- the tools (§3.1's toolbar) */

/** Select — the pointer arrow. */
export const IconSelect = createIcon("select", <path d="M5 3l14 6.5-6.2 2.3L10.4 18z" />);

/** Pan — the open hand. */
export const IconPan = createIcon(
  "pan",
  <>
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
    <path d="M15 11V6.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a5 5 0 0 1-3.6-1.5L5 16.5a1.5 1.5 0 0 1 2.2-2L9 16" />
    <path d="M9 11V9.5a1.5 1.5 0 0 0-3 0V13" />
  </>,
);

/** Linear measure — the ruler laid on the diagonal, with its three ticks. */
export const IconLinear = createIcon(
  "linear",
  <>
    <path d="M3 15.5 15.5 3 21 8.5 8.5 21z" />
    <path d="M6.5 12 9 14.5M10 8.5l2.5 2.5M13.5 5l2.5 2.5" />
  </>,
);

/** Area measure — the dashed square. */
export const IconArea = createIcon(
  "area",
  <>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M11 4h2M4 11v2M20 11v2M11 20h2" />
  </>,
);

/** Count measure — the hash. */
export const IconCount = createIcon("count", <path d="M9.5 3.5 7.5 20.5M16.5 3.5l-2 17M4 8.5h16M3.5 15.5h16" />);

/** Snap — the magnet, poles open to the sheet. */
export const IconSnap = createIcon(
  "snap",
  <>
    <path d="M6 4H3v7a9 9 0 0 0 18 0V4h-3v7a6 6 0 0 1-12 0z" />
    <path d="M3 9h3M18 9h3" />
  </>,
);

/** Ortho — the right angle held. */
export const IconOrtho = createIcon("ortho", <path d="M5 4v15h15M5 10h5v9" />);

/** Angle — two rays and the arc between them. */
export const IconAngle = createIcon(
  "angle",
  <>
    <path d="M4 20h16M4 20 17 6" />
    <path d="M12.5 20a9 9 0 0 0-1.6-5" />
  </>,
);

/** Views — the eye over the sheet. */
export const IconViews = createIcon(
  "views",
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

/** Grid — the 3 × 3 field. */
export const IconGrid = createIcon(
  "grid",
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
    <path d="M9.5 3.5v17M15 3.5v17M3.5 9.5h17M3.5 15h17" />
  </>,
);

/** Fit to sheet — the four corner brackets. */
export const IconFit = createIcon("fit", <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />);

/** Zoom in. */
export const IconZoomIn = createIcon(
  "zoom-in",
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20.5 20.5 15.5 15.5M10.5 7.5v6M7.5 10.5h6" />
  </>,
);

/** Zoom out. */
export const IconZoomOut = createIcon(
  "zoom-out",
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20.5 20.5 15.5 15.5M7.5 10.5h6" />
  </>,
);

/** Layers — the stack. */
export const IconLayers = createIcon(
  "layers",
  <>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3.5 12.5 8.5 4.7 8.5-4.7M3.5 16.8 12 21.5l8.5-4.7" />
  </>,
);

/** Inspector — the panel docked at the right. */
export const IconInspector = createIcon(
  "inspector",
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <path d="M14.5 4.5v15" />
  </>,
);

/* --------------------------------------------------------------- the chrome (§3's top bar) */

/** Search. */
export const IconSearch = createIcon(
  "search",
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20.5 20.5 15.5 15.5" />
  </>,
);

/** Copy — the sheet taken from the sheet beneath it. */
export const IconCopy = createIcon(
  "copy",
  <>
    <rect x="9" y="9" width="11.5" height="11.5" rx="2" />
    <path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" />
  </>,
);

export const IconChevronDown = createIcon("chevron-down", <path d="m6 9.5 6 6 6-6" />);
export const IconChevronUp = createIcon("chevron-up", <path d="m6 14.5 6-6 6 6" />);
export const IconChevronLeft = createIcon("chevron-left", <path d="m14.5 6-6 6 6 6" />);
export const IconChevronRight = createIcon("chevron-right", <path d="m9.5 6 6 6-6 6" />);

/** Check — the tick. */
export const IconCheck = createIcon("check", <path d="m4.5 12.5 5 5 10-11" />);

/** X — the dismissal. */
export const IconX = createIcon("x", <path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" />);

/** Alert — the triangle that carries a fault. */
export const IconAlert = createIcon(
  "alert",
  <>
    <path d="M12 3.8 22 20.2H2z" />
    <path d="M12 9.8v4.4M12 17.3h.01" />
  </>,
);

/** Info — the circle that carries a fact. */
export const IconInfo = createIcon(
  "info",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11.5v5M12 7.8h.01" />
  </>,
);

/** Upload — into the tray. */
export const IconUpload = createIcon("upload", <path d="M3.5 15.5v3A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-3M12 15.5V3.5M7.5 8 12 3.5 16.5 8" />);

/** Plus. */
export const IconPlus = createIcon("plus", <path d="M12 5v14M5 12h14" />);

/** More — the row menu's three dots. A dot is a mark, so it is the one filled glyph in the set. */
export const IconMoreHorizontal = createIcon(
  "more-horizontal",
  <>
    <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>,
);

/** External link — the place that opens away from here. */
export const IconExternalLink = createIcon("external-link", <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 14v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V8.5A1.5 1.5 0 0 1 5 7h5" />);

/** Sun — the light theme. */
export const IconSun = createIcon(
  "sun",
  <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
  </>,
);

/** Moon — the dark theme, which is the ground the product stands on. */
export const IconMoon = createIcon("moon", <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z" />);

/** User. */
export const IconUser = createIcon(
  "user",
  <>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </>,
);

/** Bell — notifications. */
export const IconBell = createIcon(
  "bell",
  <>
    <path d="M6 10a6 6 0 0 1 12 0c0 3.5.8 5 1.8 6.2.4.5 0 1.3-.6 1.3H4.8c-.7 0-1-.8-.6-1.3C5.2 15 6 13.5 6 10z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </>,
);

/** Refresh — the retry, and the jobs the top bar watches. */
export const IconRefresh = createIcon("refresh", <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5" />);

/* --------------------------------------------------------------- the states and the figures */

/** Inbox — what an EmptyState shows above its one sentence. */
export const IconInbox = createIcon(
  "inbox",
  <>
    <path d="M3.5 12.5h4l1.5 3h6l1.5-3h4" />
    <path d="M5.6 5.2 3.5 12.5V18A1.5 1.5 0 0 0 5 19.5h14a1.5 1.5 0 0 0 1.5-1.5v-5.5l-2.1-7.3A1.5 1.5 0 0 0 17 4.2H7a1.5 1.5 0 0 0-1.4 1z" />
  </>,
);

/**
 * The Bengali taka sign ৳ (U+09F3), as geometry rather than as a glyph from a font.
 *
 * Interpretation (Design Direction 00 §5 item 5, B-24): the direction asks for `৳` "from the
 * vendored Bengali subset", and a subset is a binary this session cannot produce — the machine
 * carries no `pyftsubset`, no fontTools and no Noto Sans Bengali to subset, and `pnpm exec` has no
 * network. Fabricating a woff2 is not an option, and a @font-face `src:` is a URL, which B-24
 * refuses outside the one handwritten theme file this node does not own. So the sign is traced in
 * the icon set, at the same stroke and box as every other glyph, and `MoneyText` paints it there.
 * When a real subset is vendored, this component is what gets deleted, in one place.
 */
export const IconTaka = createIcon(
  "taka",
  <>
    <path d="M4.5 6.5h2.2A2.8 2.8 0 0 1 9.5 9.3V17a2.6 2.6 0 0 0 2.6 2.6h1.6" />
    <path d="M6.6 12.4h7.2M13.4 4.4v13" />
  </>,
);
