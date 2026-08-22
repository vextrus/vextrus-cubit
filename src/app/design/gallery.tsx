'use client';
/**
 * The gallery page itself (Design Decision §2, §10).
 *
 * The page is a reader of `galleryEntries`: it knows how an entry is laid out and named, and
 * nothing about which entries exist. Three group headings partition the roster by the barrel
 * that exports each entry's first `covers` name — read from the barrels at run time, like
 * AC-2's completeness test, so a component that moves between barrels moves between groups
 * without anyone editing this file.
 *
 * The theme links are plain anchors, not client-side navigations: `data-theme` is decided by
 * the document's own script (see src/app/layout.tsx), so switching themes has to be a real
 * document load, which is also exactly what the journey does.
 */
import type { ReactElement } from 'react';
import * as dataBarrel from '../../ui/data';
import * as patternsBarrel from '../../ui/patterns';
import * as primitivesBarrel from '../../ui/primitives';
import { EmptyState } from '../../ui/patterns';
import { Toaster, galleryEntries } from './registry';
import type { GalleryEntry } from './registry';
import { ds } from './strings';
import './gallery.css';

import type { DesignStringKey } from './strings';

/** The two themes the document names (§1). */
export type Theme = 'light' | 'dark';

/** §2: `covers` names joined for the entry's `<h3>` — identifiers are data, not copy. */
const COVERS_SEPARATOR = ' · ';

const LIGHT_HREF = '/design?theme=light';
const DARK_HREF = '/design?theme=dark';
const CURRENT = 'page';

/** One group: its heading key and the barrel whose exports belong under it (§2). */
interface Group {
  readonly key: DesignStringKey;
  readonly barrel: Readonly<Record<string, unknown>>;
}

const GROUPS: readonly Group[] = [
  { key: 'design.group.primitives', barrel: primitivesBarrel },
  { key: 'design.group.patterns', barrel: patternsBarrel },
  { key: 'design.group.data', barrel: dataBarrel },
];

/**
 * The roster, split into the groups above in registry order. An entry whose first `covers`
 * name no group exports is still rendered — under the last group — because a gallery that
 * silently dropped an entry would defeat the test that makes the gallery complete (AC-2).
 */
function grouped(entries: readonly GalleryEntry[]): readonly (readonly GalleryEntry[])[] {
  const buckets: GalleryEntry[][] = GROUPS.map(() => []);
  for (const entry of entries) {
    const first = entry.covers[0] ?? '';
    const index = GROUPS.findIndex((group) => first in group.barrel);
    buckets[index < 0 ? buckets.length - 1 : index]?.push(entry);
  }
  return buckets;
}

/** One state block: the state's name as its label, and the specimen it names (§2). */
function StateBlock({ name, render }: {
  readonly name: string;
  readonly render: () => ReactElement;
}): ReactElement {
  return (
    <div className="gallery-state" data-gallery-state={name}>
      <span className="gallery-state-label">{name}</span>
      <div className="gallery-specimen">{render()}</div>
    </div>
  );
}

/** One entry: the exports it demonstrates, then every state the Design Decision names. */
function Entry({ entry }: { readonly entry: GalleryEntry }): ReactElement {
  return (
    <section className="gallery-entry" data-testid={`gallery-entry-${entry.slug}`}>
      <h3 className="gallery-entry-title">{entry.covers.join(COVERS_SEPARATOR)}</h3>
      <div className="gallery-states">
        {entry.states.map((state) => (
          <StateBlock key={state.name} name={state.name} render={state.render} />
        ))}
      </div>
    </section>
  );
}

export function Gallery({ theme }: { readonly theme: Theme }): ReactElement {
  const buckets = grouped(galleryEntries);
  return (
    <main className="gallery" data-testid="design-gallery">
      <header className="gallery-header">
        <h1 className="gallery-title">{ds('design.title')}</h1>
        <p className="gallery-lede">{ds('design.lede')}</p>
        <nav className="gallery-themes" aria-label={ds('design.theme.label')}>
          <a
            className="gallery-theme-link datum-focus-ring"
            href={LIGHT_HREF}
            aria-current={theme === 'light' ? CURRENT : undefined}
          >
            {ds('design.theme.light')}
          </a>
          <a
            className="gallery-theme-link datum-focus-ring"
            href={DARK_HREF}
            aria-current={theme === 'dark' ? CURRENT : undefined}
          >
            {ds('design.theme.dark')}
          </a>
        </nav>
      </header>

      {galleryEntries.length === 0 ? (
        // §5: the page never renders silently blank (R-UI-020), even with an empty registry.
        <EmptyState title={ds('design.empty.title')} teach={ds('design.empty.teach')} />
      ) : (
        GROUPS.map((group, index) => {
          const entries = buckets[index] ?? [];
          if (entries.length === 0) return null;
          return (
            <section className="gallery-group" key={group.key}>
              <h2 className="gallery-group-title">{ds(group.key)}</h2>
              {entries.map((entry) => (
                <Entry key={entry.slug} entry={entry} />
              ))}
            </section>
          );
        })
      )}

      <Toaster />
    </main>
  );
}
