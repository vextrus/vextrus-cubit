/**
 * The gallery's own two strings, authored once (Decision I-17). Everything else the page shows is
 * either a machine identifier read off the derivation — a barrel id, an entry key, a state name —
 * or copy the sample's owning Decision already fixed.
 */
export const galleryChrome = {
  heading: "Design gallery",
  caption: "Every shipped component, rendered in every state it can hold, with sample data.",
} as const;
