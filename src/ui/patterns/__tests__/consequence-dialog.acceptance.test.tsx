// @vitest-environment jsdom
/**
 * inc-006 acceptance — ConsequenceDialog: preview → digest → confirm (AC-4; R-UI-021,
 * L-ACT-02).
 *
 * R-UI-021: "every act opens a ConsequenceDialog showing the typed consequence (counts of rows
 * affected, signatures voided, denominators widened) computed by the server; confirm carries
 * the digest; a stale digest re-renders the dialog with what changed." L-ACT-02 is the law
 * behind it — `preview(input) → Consequence` and `commit(input, consequenceDigest)`, with a
 * commit whose digest is not the current one refused.
 *
 * This leaf ships the client half, so the assertions are about what the dialog does with a
 * `Consequence` it is handed: it renders the lines it was given (it never computes a count),
 * it confirms with exactly the digest of what the reader is looking at, and it takes a stale
 * consequence as an instruction to re-render rather than as an error to report.
 *
 * The lines are the fixture's own, and the assertions are derived from them: a line's label
 * and its count as the document writes it (R-SPINE-061 lakh/crore, which is what the count
 * seam produces and what an ambient `toLocaleString` would not). Nothing here is copied from
 * an implementation.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmResult, Consequence } from '../index';

type PatternsModule = typeof import('../index');

/** The barrel, per test (see the file header). */
const patternsModule = async (): Promise<PatternsModule> => await import('../index');

/** Copy and values the fixtures need; JSX carries no string literal (R-SPINE-060). */
const TITLE = 'Void the signatures on this measurement';

const ROWS_LABEL = 'Rows affected';
const SIGNATURES_LABEL = 'Signatures voided';
const EXPORTS_LABEL = 'Exports invalidated';

/**
 * The preview the server computed. The row count is a lakh so the rendering says which seam
 * wrote it: R-SPINE-061 groups it 1,00,000, a Western default would not.
 */
const PREVIEW: Consequence = {
  digest: 'sha256:1a2b3c',
  lines: [
    { key: 'rows', label: ROWS_LABEL, count: 100_000 },
    { key: 'signatures', label: SIGNATURES_LABEL, count: 3 },
  ],
};

/** What the same act previews to a moment later: one count moved, one line arrived. */
const STALE: Consequence = {
  digest: 'sha256:9f8e7d',
  lines: [
    { key: 'rows', label: ROWS_LABEL, count: 100_001 },
    { key: 'signatures', label: SIGNATURES_LABEL, count: 3 },
    { key: 'exports', label: EXPORTS_LABEL, count: 4 },
  ],
};

/** The document's own grouping of the two counts that move (R-SPINE-061). */
const PREVIEW_ROWS_TEXT = '1,00,000';
const STALE_ROWS_TEXT = '1,00,001';

const text = (element: HTMLElement): string => (element.textContent ?? '').trim();

const dialogText = (): string => text(screen.getByTestId('consequence-dialog'));

const lineTexts = (): string[] => screen.queryAllByTestId('consequence-line').map(text);

/**
 * The text a stale marker speaks for: the marker's own, plus that of the line it sits in.
 * AC-4 says each changed line is *marked*; which element carries the mark — the row itself or
 * something inside it — is the module's business.
 */
function staleReadings(): string[] {
  const readings: string[] = [];
  for (const marked of screen.queryAllByTestId('consequence-stale')) {
    readings.push(text(marked));
    const line = marked.closest('[data-testid="consequence-line"]');
    if (line !== null) readings.push((line.textContent ?? '').trim());
  }
  return readings;
}

const isMarkedStale = (label: string): boolean =>
  staleReadings().some((reading) => reading.includes(label));

afterEach(cleanup);

/**
 * A dialog whose `open` is owned by the caller, as R-UI-021's contract requires: the component
 * asks to close through `onOpenChange` and the owner decides. Built per test so the component
 * under test comes from the awaited barrel.
 */
function harness(
  ConsequenceDialog: PatternsModule['ConsequenceDialog'],
  onConfirm: (digest: string) => Promise<ConfirmResult>,
): () => ReactElement {
  return function Harness(): ReactElement {
    const [open, setOpen] = useState(true);
    return (
      <ConsequenceDialog
        open={open}
        onOpenChange={setOpen}
        title={TITLE}
        consequence={PREVIEW}
        onConfirm={onConfirm}
      />
    );
  };
}

describe('AC-4 — the dialog renders the consequence it was handed (R-UI-021)', () => {
  it('renders one line per Consequence line, with its label and its count', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(async (_digest: string): Promise<ConfirmResult> => ({ ok: true }));
    const Harness = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    expect(screen.getByTestId('consequence-dialog')).toBeDefined();
    expect(dialogText()).toContain(TITLE);

    const lines = lineTexts();
    expect(lines.length, 'one row per typed consequence line').toBe(PREVIEW.lines.length);

    const joined = lines.join(' | ');
    expect(joined).toContain(ROWS_LABEL);
    expect(joined).toContain(SIGNATURES_LABEL);
    // The counts arrive typed from the preview; the dialog only writes them down.
    expect(joined, 'the row count is not written the way the document writes it').toContain(
      PREVIEW_ROWS_TEXT,
    );
    expect(joined).toContain('3');

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with exactly the digest of the consequence on screen (L-ACT-02)', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(async (_digest: string): Promise<ConfirmResult> => ({ ok: true }));
    const Harness = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]).toBe(PREVIEW.digest);
  });

  it('closes on a confirm the server accepted', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(async (_digest: string): Promise<ConfirmResult> => ({ ok: true }));
    const Harness = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('consequence-dialog')).toBeNull();
    });
  });
});

describe('AC-4 — a stale digest re-renders what changed (R-UI-021, L-ACT-02)', () => {
  it('stays open, re-renders from the stale consequence and marks the changed lines', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(
      async (_digest: string): Promise<ConfirmResult> => ({ ok: false, stale: STALE }),
    );
    const Harness = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });

    // Open: a refused commit is a thing to read, not a dialog that vanishes.
    expect(screen.getByTestId('consequence-dialog')).toBeDefined();

    // Re-rendered from `stale`: every line it carries is on screen, including the one that
    // was not in the preview at all.
    const reading = dialogText();
    for (const line of STALE.lines) expect(reading).toContain(line.label);
    expect(reading, 'the changed count was not re-rendered').toContain(STALE_ROWS_TEXT);
    expect(screen.queryAllByTestId('consequence-line').length).toBe(STALE.lines.length);

    // Marked: the two lines that changed — a count that moved and a key that arrived — and
    // not the one that did not.
    expect(isMarkedStale(ROWS_LABEL), `${ROWS_LABEL} changed and is not marked`).toBe(true);
    expect(isMarkedStale(EXPORTS_LABEL), `${EXPORTS_LABEL} is new and is not marked`).toBe(true);
    expect(
      isMarkedStale(SIGNATURES_LABEL),
      `${SIGNATURES_LABEL} did not change and must not be marked`,
    ).toBe(false);
  });
});
