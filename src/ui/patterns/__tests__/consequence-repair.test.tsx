// @vitest-environment jsdom
/**
 * ConsequenceDialog: the three repairs the review named.
 *
 *   - a commit that *rejects* is the third outcome `ConfirmResult` does not name. Left
 *     unhandled it is an unhandled rejection and a button that quietly stops spinning — the
 *     exact silence R-UI-020 forbids;
 *   - a restatement belongs to a preview, and a preview is identified by its digest, not by the
 *     object a parent happens to have re-created this render. The commonest call site writes
 *     `consequence={{ digest, lines }}` inline, so an identity test discards the restatement on
 *     any unrelated re-render — putting the outdated counts back and re-sending a digest the
 *     server has already refused;
 *   - closing ends the episode: a dialog reopened later does not greet the reader with the last
 *     attempt's news.
 *
 * No shims: like the acceptance suites, this runs in a jsdom with no observers in it.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmResult, Consequence } from '../index';
import { PATTERNS_STRINGS } from '../strings';

type PatternsModule = typeof import('../index');

const patternsModule = async (): Promise<PatternsModule> => await import('../index');

const TITLE = 'Void the signatures on this measurement';
const ROWS_LABEL = 'Rows affected';
const DIGEST = 'sha256:1a2b3c';
const STALE_DIGEST = 'sha256:9f8e7d';
const NEXT_DIGEST = 'sha256:0000aa';
const PREVIEW_COUNT = 12;
const STALE_COUNT = 13;

/** The failure the commit reports by never answering at all. */
const DROPPED = new Error('the commit never answered');

const STALE: Consequence = {
  digest: STALE_DIGEST,
  lines: [{ key: 'rows', label: ROWS_LABEL, count: STALE_COUNT }],
};

afterEach(cleanup);

/**
 * The dialog under a parent that re-renders for its own reasons and builds `consequence` as a
 * fresh literal each time — the shape a screen actually writes.
 */
function harness(
  ConsequenceDialog: PatternsModule['ConsequenceDialog'],
  onConfirm: (digest: string) => Promise<ConfirmResult>,
  digest = DIGEST,
): { readonly Harness: () => ReactElement; readonly nudge: string; readonly reopen: string } {
  const nudge = 'harness-nudge';
  const reopen = 'harness-reopen';
  return {
    nudge,
    reopen,
    Harness: function Harness(): ReactElement {
      const [open, setOpen] = useState(true);
      const [, setTick] = useState(0);
      return (
        <>
          <button
            type="button"
            data-testid={nudge}
            onClick={() => {
              setTick((value) => value + 1);
            }}
          />
          <button
            type="button"
            data-testid={reopen}
            onClick={() => {
              setOpen(true);
            }}
          />
          <ConsequenceDialog
            open={open}
            onOpenChange={setOpen}
            title={TITLE}
            // Rebuilt every render, exactly as an inline preview from a query hook is.
            consequence={{ digest, lines: [{ key: 'rows', label: ROWS_LABEL, count: PREVIEW_COUNT }] }}
            onConfirm={onConfirm}
          />
        </>
      );
    },
  };
}

const counts = (): string[] =>
  screen.getAllByTestId('consequence-line').map((line) => line.textContent ?? '');

describe('ConsequenceDialog — a commit that never answers is still answered (R-UI-020)', () => {
  it('says so in place, leaves the dialog open and un-busies confirm', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(
      async (_digest: string): Promise<ConfirmResult> => Promise.reject(DROPPED),
    );
    const { Harness } = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });

    // Said, not swallowed: the reader pressed a button and is told what became of it.
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(PATTERNS_STRINGS['patterns.consequence.failed']);
    expect(screen.getByTestId('consequence-dialog')).toBeTruthy();

    // And the control is live again — a second attempt is the remedy the copy offers.
    const confirm = screen.getByTestId('consequence-confirm');
    expect(confirm.getAttribute('aria-busy')).not.toBe('true');
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});

describe('ConsequenceDialog — a restatement survives its parent (L-ACT-02)', () => {
  it('keeps the stale lines and the stale digest across an unrelated re-render', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(
      async (_digest: string): Promise<ConfirmResult> => ({ ok: false, stale: STALE }),
    );
    const { Harness, nudge } = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });
    expect(counts().join(' ')).toContain(String(STALE_COUNT));
    expect(screen.getAllByTestId('consequence-stale').length).toBeGreaterThan(0);

    // The parent re-renders for its own reasons; the preview literal is rebuilt, the fact it
    // describes is not. What the reader is looking at must not revert.
    await act(async () => {
      fireEvent.click(screen.getByTestId(nudge));
    });
    expect(counts().join(' ')).toContain(String(STALE_COUNT));
    expect(counts().join(' ')).not.toContain(String(PREVIEW_COUNT));
    expect(screen.getAllByTestId('consequence-stale').length).toBeGreaterThan(0);

    // And the next confirm still carries the digest the reader is looking at.
    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });
    expect(onConfirm).toHaveBeenLastCalledWith(STALE_DIGEST);
  });

  it('drops the restatement when a genuinely new preview arrives', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(
      async (_digest: string): Promise<ConfirmResult> => ({ ok: false, stale: STALE }),
    );
    const { Harness } = harness(ConsequenceDialog, onConfirm);
    const view = render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });
    expect(screen.getAllByTestId('consequence-stale').length).toBeGreaterThan(0);

    const fresh = harness(ConsequenceDialog, onConfirm, NEXT_DIGEST);
    view.rerender(<fresh.Harness />);

    expect(screen.queryAllByTestId('consequence-stale')).toEqual([]);
    expect(counts().join(' ')).toContain(String(PREVIEW_COUNT));
  });
});

describe('ConsequenceDialog — closing ends the episode (§9)', () => {
  it('clears the stale notice, so a reopened dialog reports no old news', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(
      async (_digest: string): Promise<ConfirmResult> => ({ ok: false, stale: STALE }),
    );
    const { Harness, reopen } = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });
    expect(screen.getAllByTestId('consequence-stale').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-cancel'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(reopen));
    });

    expect(screen.queryAllByTestId('consequence-stale')).toEqual([]);
    expect(counts().join(' ')).toContain(String(PREVIEW_COUNT));
  });
});
