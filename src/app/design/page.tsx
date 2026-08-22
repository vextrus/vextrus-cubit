/**
 * `/design` — the living component gallery (R-UI-011, S-Design).
 *
 * Unauthenticated and outside any tenant group: the sheet is the design system's own drawing
 * register, read by whoever is building or grading Datum, and the visual-baseline suite has to
 * reach it without a session (recorded interpretation; auth ships with the auth increment).
 *
 * The segment reads one query value and hands it on. `?state=` forces one of the screen's
 * seven R-UI-050 states (Design Decision §2); anything else, or nothing, is the live gallery —
 * the screen decides that, so the page stays a pass-through.
 */
import { GalleryScreen } from '../../ui/gallery';

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const state = query.state;
  return <GalleryScreen screenState={typeof state === 'string' ? state : undefined} />;
}
