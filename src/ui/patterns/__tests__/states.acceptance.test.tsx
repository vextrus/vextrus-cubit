// @vitest-environment jsdom
/**
 * inc-006 acceptance — the R-UI-050 roster src/ui/patterns ships (AC-5).
 *
 * R-UI-050: "Every screen defines and renders: loading (skeleton), empty (teaches next
 * action), error (retry + report id), refusal (code + remedy), partial (some rows refused:
 * shown, not hidden), offline (banner; read-only), permission-denied (what permission, who
 * holds it)." A screen can only render those seven if the components exist; this leaf is where
 * six of them land (loading is the Skeleton primitive, consumed not rebuilt; refusal is
 * RefusalState, in refusal.acceptance.test.tsx).
 *
 * The barrel roster is asserted as a floor, never as a frozen set: `src/ui/patterns` is a
 * module later leaves keep filling, and an assertion that pinned the export list would pass
 * today and redden the first increment that lawfully adds to it.
 *
 * What each component *means* — the retry firing once per activation, the banner's role, the
 * permission and its holder both reaching the text — is the held-out half of this criterion;
 * what is here is that the six exist, mount and carry the state's own substance.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type PatternsModule = typeof import('../index');

/** The barrel, per test (see the file header). */
const patternsModule = async (): Promise<PatternsModule> => await import('../index');

/** The Increment Spec's `interfaces` line for src/ui/patterns — a floor, never a ceiling. */
const ROSTER: readonly string[] = [
  'EmptyState',
  'ErrorState',
  'PartialNotice',
  'OfflineBanner',
  'PermissionDenied',
  'RefusalState',
  'ConsequenceDialog',
  'EvidenceLink',
];

/** Copy and values the fixtures need; JSX carries no string literal (R-SPINE-060). */
const EMPTY_TITLE = 'No measurements yet';
const EMPTY_TEACH = 'Record a measurement against this line to start its coverage.';
const EMPTY_ACTION = 'Record a measurement';
const REPORT_ID = 'rpt_01JD8Z2V3K';
const PERMISSION = 'measurement.void';
const HOLDER = 'the project quantity surveyor';

/**
 * A refused-row count large enough to say which seam wrote it: R-SPINE-061 groups a lakh as
 * 1,00,000, and `formatNumber(String(n), 'count')` is the only place that grouping comes from.
 */
const REFUSED = 100_000;
const REFUSED_TEXT = '1,00,000';

const text = (element: HTMLElement): string => (element.textContent ?? '').trim();

afterEach(cleanup);

describe('AC-5 — the src/ui/patterns barrel carries its roster (R-UI-050, R-UI-010)', () => {
  it('exports every name the Increment Spec declares', async () => {
    const exported = new Set(Object.keys(await patternsModule()));
    const missing = ROSTER.filter((name) => !exported.has(name));
    expect(missing, `src/ui/patterns/index.ts exports no: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('AC-5 — empty teaches the next action (R-UI-050)', () => {
  it('renders its title and its teaching sentence', async () => {
    const { EmptyState } = await patternsModule();
    render(<EmptyState title={EMPTY_TITLE} teach={EMPTY_TEACH} />);

    const state = screen.getByTestId('empty-state');
    expect(text(state)).toContain(EMPTY_TITLE);
    // "teaches next action": the sentence the screen wrote is the state's substance, so it is
    // rendered, not summarised.
    expect(text(state)).toContain(EMPTY_TEACH);
    expect(screen.queryByTestId('empty-state-action')).toBeNull();
  });

  it('offers the action when it is given one', async () => {
    const { EmptyState } = await patternsModule();
    const onAction = vi.fn();
    render(
      <EmptyState
        title={EMPTY_TITLE}
        teach={EMPTY_TEACH}
        actionLabel={EMPTY_ACTION}
        onAction={onAction}
      />,
    );

    const action = screen.getByTestId('empty-state-action');
    expect(text(action)).toContain(EMPTY_ACTION);
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalled();
  });
});

describe('AC-5 — error carries a retry and a report id (R-UI-050)', () => {
  it('renders both, with the report id verbatim', async () => {
    const { ErrorState } = await patternsModule();
    const onRetry = vi.fn();
    render(<ErrorState reportId={REPORT_ID} onRetry={onRetry} />);

    expect(screen.getByTestId('error-state')).toBeDefined();
    // Verbatim: a report id a reader cannot quote back is not a report id.
    expect(text(screen.getByTestId('error-state-report-id'))).toContain(REPORT_ID);
    expect(screen.getByTestId('error-state-retry')).toBeDefined();
  });
});

describe('AC-5 — partial shows the refused rows rather than hiding them (R-UI-050)', () => {
  it('states how many rows were refused, through the count seam', async () => {
    const { PartialNotice } = await patternsModule();
    render(<PartialNotice refusedCount={REFUSED} />);

    const notice = screen.getByTestId('partial-notice');
    expect(text(notice), 'the refused count is not written the way the document writes it')
      .toContain(REFUSED_TEXT);
    // The words carry the meaning, not a tint (R-UI-060): the notice says something.
    expect(text(notice).length).toBeGreaterThan(REFUSED_TEXT.length);
  });
});

describe('AC-5 — offline says the screen is read-only (R-UI-050)', () => {
  it('renders the banner with read-only wording', async () => {
    const { OfflineBanner } = await patternsModule();
    render(<OfflineBanner />);

    const banner = screen.getByTestId('offline-banner');
    // R-UI-050: "offline (banner; read-only)" — the reader is told what they may still do.
    expect(text(banner)).toMatch(/read[- ]only/i);
  });
});

describe('AC-5 — permission-denied names the permission (R-UI-050)', () => {
  it('renders the permission it needed', async () => {
    const { PermissionDenied } = await patternsModule();
    render(<PermissionDenied permission={PERMISSION} holder={HOLDER} />);

    expect(text(screen.getByTestId('permission-denied'))).toContain(PERMISSION);
  });
});
