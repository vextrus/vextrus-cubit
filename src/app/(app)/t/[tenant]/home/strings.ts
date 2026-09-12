// S-Home's own copy, for the four labels the v22 rebuild needs and the shared table does not hold.
//
// WHY A ROUTE-LOCAL TABLE. Every other word on this screen is read by key from `src/ui/strings/home.ts`
// — the shared registry — and nothing there is renamed or respelled. These four name things the
// card-and-prose screen never had: a column of last acts, a tile of estimated value, the search
// field over the list and the row's own menu. The idiom is the one S-Audit, S-Project, S-Drawings
// and S-Members already use (s-settings-ruleset I-24: a screen's copy may live beside the screen,
// keyed like the shared tables), so the screen still spells no string literal in its JSX. When the
// foundation node opens `src/ui/strings/home.ts` again these four move there unchanged, by key.
export const homeScreenStrings = {
  /** The table's sixth column: when this project was last acted on (Design Direction 00 §3.3). */
  home_col_last_act: "Last act",
  /** The fourth stat tile: what this workspace's projects are estimated to be worth, in ৳. */
  home_stat_value: "Estimated value",
  /** The accessible name of the title row's filter field — the placeholder is a hint, not a name. */
  home_search_label: "Search projects",
  /** The accessible name of a row's `⋯` menu, which holds Edit, Archive/Restore and the rule set. */
  home_row_actions: "Project actions",
} as const;

/** A key of this screen's own table, for a roster that labels its entries by one. */
export type HomeScreenStringKey = keyof typeof homeScreenStrings;
