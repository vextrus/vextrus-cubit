/**
 * S-Design — the living component gallery (R-UI-011, Design Decision docs/design/s-design.md).
 *
 * A drawing register, not a marketing page: every public component of the Datum surface, in
 * every state its entry declares, on deterministic local sample data, in whichever theme the
 * one control in the top bar is set to.
 *
 * The screen has its own seven R-UI-050 states, forced through `?state=` and never inferred:
 * nothing here loads, fails or is refused, so the states exist to be drawn and screenshotted.
 * Chrome always renders — the top bar and the rail are not what failed — and `partial` and
 * `offline` put their bar above the full sheet rather than in place of it, because R-UI-050
 * says refused rows are shown, not hidden.
 */
'use client';
import type { ReactElement, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { DESIGN_STRINGS, dsg } from '../../app/design/strings';
import { formatNumber } from '../../core/format';
import {
  EmptyState,
  ErrorState,
  OfflineBanner,
  PartialNotice,
  PermissionDenied,
  RefusalState,
} from '../patterns';
import { Skeleton, Switch } from '../primitives';
import { galleryModules } from './registry';
import type { GalleryModuleGroup } from './registry';
import { gsKeyed } from './strings';
import type { GalleryEntry, ScreenStateName } from './types';
import './gallery.css';

/** The placeholder `design.count` carries; punctuation of the template, not copy. */
const COUNT_SLOT = '{count}';

/** The route this screen answers on — a path, not words (Design Decision §11). */
const ROUTE = '/design';

/** The report id the forced error state shows: a code, rendered verbatim (§2). */
const REPORT_ID = 'DSGN-0001';

/** The registered refusal code the forced refusal state renders in place (R-UI-020, §2). */
const REFUSAL_CODE = 'STORAGE_URL_EXPIRED';

/** The permission the forced permission-denied state names: a code (§2). */
const PERMISSION = 'design.read';

/** How many rows the forced partial state reports refused (§2). */
const REFUSED_COUNT = 2;

/** The two values the toggle writes on the document root (§3). */
const DARK = 'dark';
const LIGHT = 'light';
const THEME_ATTRIBUTE = 'data-theme';

/** The loading skeleton's geometry: layout dimensions the decision states (§2, §9). */
const RAIL_BARS = 6;
const CARD_BLOCKS = 8;

/** The seven forced states, in the decision's order (§2). */
const SCREEN_STATES: readonly ScreenStateName[] = [
  'loading',
  'empty',
  'error',
  'refusal',
  'partial',
  'offline',
  'permission-denied',
];

const isScreenState = (value: string | undefined): value is ScreenStateName =>
  value !== undefined && (SCREEN_STATES as readonly string[]).includes(value);

/** The states that stand in place of the sheet; `partial` and `offline` stand above it (§2). */
const BLOCKING: readonly ScreenStateName[] = [
  'loading',
  'empty',
  'error',
  'refusal',
  'permission-denied',
];

/**
 * The one entry whose samples are given the card's full width (§1): a virtualised table beside
 * a chip would be two things fighting for one row.
 */
const WIDE_ENTRY = 'data-table';
const CELL = 'datum-gallery-cell';
const WIDE_CELL = 'datum-gallery-cell datum-gallery-cell-wide';

/* ---- The sheet ------------------------------------------------------------------------ */

function EntryCard({ entry }: { entry: GalleryEntry }): ReactElement {
  return (
    <section id={entry.id} className="datum-gallery-card">
      <header className="datum-gallery-card-head">
        <h3 className="datum-gallery-card-title">{gsKeyed(`gallery.entry.${entry.id}`)}</h3>
        {/* Export names are identifiers, not copy: they are rendered as the source spells
            them, in the mono face R-UI-003 keeps for keys (§1). */}
        <span className="datum-gallery-card-covers">{entry.covers.join(' ')}</span>
      </header>
      <div className="datum-gallery-card-body">
        {entry.states.map((state) => (
          <div
            key={state.name}
            data-testid={`gallery-entry-${entry.id}-${state.name}`}
            className={entry.id === WIDE_ENTRY ? WIDE_CELL : CELL}
          >
            <span className="datum-gallery-cell-label">{gsKeyed(`gallery.state.${state.name}`)}</span>
            {state.render()}
          </div>
        ))}
      </div>
    </section>
  );
}

function ModuleSection({ group }: { group: GalleryModuleGroup }): ReactElement {
  return (
    <section className="datum-gallery-section">
      <h2 className="datum-gallery-section-title">{DESIGN_STRINGS[group.moduleKey]}</h2>
      {group.entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
    </section>
  );
}

const Sheet = (): ReactElement => (
  <>
    {galleryModules.map((group) => (
      <ModuleSection key={group.moduleKey} group={group} />
    ))}
  </>
);

/* ---- Rail ----------------------------------------------------------------------------- */

function Rail({ loading }: { loading: boolean }): ReactElement {
  return (
    <nav aria-label={dsg('design.nav')} className="datum-gallery-rail">
      {loading
        ? Array.from({ length: RAIL_BARS }, (_, index) => (
            <Skeleton key={index} className="datum-gallery-loading-bar" />
          ))
        : galleryModules.map((group) => (
            <div key={group.moduleKey}>
              <div className="datum-gallery-rail-label">{DESIGN_STRINGS[group.moduleKey]}</div>
              {group.entries.map((entry) => (
                <a
                  key={entry.id}
                  href={`#${entry.id}`}
                  className="datum-gallery-rail-link datum-focus-ring"
                >
                  {gsKeyed(`gallery.entry.${entry.id}`)}
                </a>
              ))}
            </div>
          ))}
    </nav>
  );
}

/* ---- The screen's own states (§2) ------------------------------------------------------ */

function ForcedState({
  state,
  onRetry,
}: {
  state: ScreenStateName;
  onRetry: () => void;
}): ReactElement {
  const body = (): ReactNode => {
    switch (state) {
      case 'loading':
        return Array.from({ length: CARD_BLOCKS }, (_, index) => (
          <Skeleton key={index} className="datum-gallery-loading-card" />
        ));
      case 'empty':
        return <EmptyState title={dsg('design.empty.title')} teach={dsg('design.empty.teach')} />;
      case 'error':
        return <ErrorState reportId={REPORT_ID} onRetry={onRetry} />;
      case 'refusal':
        return <RefusalState code={REFUSAL_CODE} evidenceHref={ROUTE} />;
      case 'permission-denied':
        return <PermissionDenied permission={PERMISSION} holder={dsg('design.permission.holder')} />;
      case 'partial':
        return (
          <>
            <div className="datum-gallery-state-banner">
              <PartialNotice refusedCount={REFUSED_COUNT} />
            </div>
            <Sheet />
          </>
        );
      case 'offline':
        return (
          <>
            <div className="datum-gallery-state-banner">
              <OfflineBanner />
            </div>
            <Sheet />
          </>
        );
    }
  };

  return (
    <div
      data-testid={`design-screen-state-${state}`}
      className="datum-gallery-state"
      aria-busy={state === 'loading' ? true : undefined}
    >
      {body()}
    </div>
  );
}

/* ---- The screen ------------------------------------------------------------------------ */

export interface GalleryScreenProps {
  /** The `?state=` value, passed through by the `/design` page. Anything else is the sheet. */
  readonly screenState?: string | undefined;
}

export function GalleryScreen({ screenState }: GalleryScreenProps): ReactElement {
  const [forced, setForced] = useState<string | undefined>(screenState);
  const [dark, setDark] = useState(false);

  const flip = useCallback((next: boolean): void => {
    setDark(next);
    document.documentElement.setAttribute(THEME_ATTRIBUTE, next ? DARK : LIGHT);
  }, []);

  // The honest recovery from a forced state: drop the query and render the live sheet. The
  // URL is replaced rather than pushed — a state nobody navigated to is not a step back (§2).
  const retry = useCallback((): void => {
    setForced(undefined);
    window.history.replaceState({}, '', ROUTE);
  }, []);

  const state = isScreenState(forced) ? forced : undefined;
  const blocking = state !== undefined && BLOCKING.includes(state);
  const [countBefore, countAfter] = dsg('design.count').split(COUNT_SLOT);
  const count = galleryModules.reduce((total, group) => total + group.entries.length, 0);

  return (
    <div data-testid="design-gallery-root" className="datum-gallery-root">
      <header className="datum-gallery-bar">
        <h1 className="datum-gallery-title">{dsg('design.title')}</h1>
        <span className="datum-gallery-count">
          {countBefore}
          <span className="numeric">{formatNumber(String(count), 'count')}</span>
          {countAfter}
        </span>
        <span className="datum-gallery-theme">
          <span className="datum-gallery-theme-label">{dsg('design.theme')}</span>
          <Switch
            data-testid="design-theme-toggle"
            aria-label={dsg('design.theme')}
            checked={dark}
            onCheckedChange={flip}
          />
        </span>
      </header>

      <div className="datum-gallery-body">
        <Rail loading={state === 'loading'} />
        <main className="datum-gallery-main">
          {state !== undefined && <ForcedState state={state} onRetry={retry} />}
          {!blocking && state === undefined && <Sheet />}
        </main>
      </div>
    </div>
  );
}
