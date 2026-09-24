// R-UI-050's matrix for S-Ask, in the one enumerable place a suite reflects over (B-19): exactly what
// `ask-screen[data-state]` can wear, in the order the Decision §2 resolves them — first holding wins.
// `error`, `refused` and `partial` read the NEWEST answer of the thread; the screen's own read failing
// is `error` too. A clarify is a question back, not a partial answer, so it stands the screen `ready`.

export const ASK_STATES = ["loading", "denied", "offline", "error", "refused", "empty", "partial", "ready"] as const;

/** One of them. */
export type AskState = (typeof ASK_STATES)[number];

/** How an answer in the thread stands (`ask-answer[data-answer]`, §1.1). */
export const ASK_ARTICLE_STATES = ["answering", "answered", "partial", "clarify", "refused", "failed"] as const;

/** One of them. */
export type AskArticleState = (typeof ASK_ARTICLE_STATES)[number];

/** What the screen's state is derived from. */
export type AskStanding = {
  /** The page is still being read (the route's own `loading.tsx` stands for it). */
  readonly loading: boolean;
  /** The reader is not a participant on this project (I-406). */
  readonly denied: boolean;
  readonly offline: boolean;
  /** The page's own read failed and left a report id. */
  readonly readFailed: boolean;
  /** A campaign is pinned, so there is anything to ask. */
  readonly campaign: boolean;
  /** How the newest answer of the thread stands, or null for an empty thread. */
  readonly newest: AskArticleState | null;
};

/** The one derivation of `data-state` (§2): first holding wins, in `ASK_STATES`' order. */
export function askStateOf(standing: AskStanding): AskState {
  if (standing.loading) return "loading";
  if (standing.denied) return "denied";
  if (standing.offline) return "offline";
  if (standing.readFailed || standing.newest === "failed") return "error";
  if (standing.newest === "refused") return "refused";
  if (!standing.campaign || standing.newest === null) return "empty";
  if (standing.newest === "partial") return "partial";
  return "ready";
}
