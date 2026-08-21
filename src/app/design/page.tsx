/**
 * `GET /design` — the living gallery (R-UI-011, S-Design).
 *
 * The route reads one thing: `?theme=`. It decides the theme for the nav's `aria-current`
 * (§2) and hands it to the gallery; `<html data-theme>` itself is set in the root layout,
 * which is the only place that element exists. Everything else on this page is static: no
 * fetch, no auth, no live data (§1).
 */
import type { ReactElement } from 'react';
import { Gallery } from './gallery';
import { DESIGN_STRINGS } from './strings';
import type { Theme } from './gallery';

/**
 * §1: the document title comes from the same table every other word on the page comes from.
 *
 * The object is left to Next's own validation rather than annotated `Metadata`: importing a
 * type from `next` pulls that package's global `ProcessEnv` augmentation into every file tsc
 * compiles, which reddens suites that hand `spawnSync` an env of their own.
 */
export const metadata = { title: DESIGN_STRINGS['design.docTitle'] };

const DARK: Theme = 'dark';
const LIGHT: Theme = 'light';

/** Next hands a page its query as a promise; a repeated key arrives as an array. */
type Query = Record<string, string | string[] | undefined>;

/** §1: `dark` for that exact value; light for anything else, including nothing at all. */
function themeOf(query: Query): Theme {
  const raw = query['theme'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === DARK ? DARK : LIGHT;
}

export default async function DesignPage({
  searchParams,
}: {
  readonly searchParams: Promise<Query>;
}): Promise<ReactElement> {
  return <Gallery theme={themeOf(await searchParams)} />;
}
