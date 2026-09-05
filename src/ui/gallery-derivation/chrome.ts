/**
 * The gallery's own two strings, under the names the derivation knows them by (Decision I-17). The
 * copy itself lives in the one string table every screen reads (R-SPINE-060, B-17): a sentence a
 * person sees, spelled beside the code that shows it, is a second table nobody can enumerate.
 * Everything else the page shows is either a machine identifier read off the derivation — a barrel
 * id, an entry key, a state name — or copy the sample's owning Decision already fixed.
 */
import { strings } from "../strings";

export const galleryChrome = {
  heading: strings.design_gallery_heading,
  caption: strings.design_gallery_caption,
} as const;
