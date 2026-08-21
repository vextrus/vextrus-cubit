// @vitest-environment jsdom
/**
 * ConsequenceDialog: the parts of §9's contract the public acceptance does not drive.
 *
 * R-UI-021 and L-ACT-02 make three promises beyond "render the lines and confirm with the
 * digest", and each is a way an act could be written twice or written blind:
 *
 *   - cancel closes without ever calling `onConfirm` — a dismissal is not a commit;
 *   - while a commit is in flight the confirm control refuses a second activation, because
 *     every act in CUBIT is a document and a double click on a slow commit writes two;
 *   - after a stale restatement the *next* confirm carries `stale.digest` — the reader
 *     confirms what is on screen now, never what was on screen before.
 *
 * No shims: like the acceptance suites, this runs in a jsdom with no observers in it.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmResult, Consequence } from '../index';

type PatternsModule = typeof import('../index');

const patternsModule = async (): Promise<PatternsModule> => await import('../index');

/** Copy and values the fixtures need; JSX carries no string literal (R-SPINE-060). */
const TITLE = 'Void the signatures on this measurement';
const ROWS_LABEL = 'Rows affected';

const PREVIEW: Consequence = {
  digest: 'sha256:1a2b3c',
  lines: [{ key: 'rows', label: ROWS_LABEL, count: 12 }],
};

const STALE: Consequence = {
  digest: 'sha256:9f8e7d',
  lines: [{ key: 'rows', label: ROWS_LABEL, count: 13 }],
};

afterEach(cleanup);

/** The dialog with its `open` held by the caller, as R-UI-021's contract requires. */
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

describe('ConsequenceDialog — a dismissal is not a commit (R-UI-021)', () => {
  it('closes on cancel without calling onConfirm', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(async (_digest: string): Promise<ConfirmResult> => ({ ok: true }));
    const Harness = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-cancel'));
    });

    expect(screen.queryByTestId('consequence-dialog')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ConsequenceDialog — one activation is one act (L-ACT-02)', () => {
  it('refuses a second confirm while the first is in flight', async () => {
    const { ConsequenceDialog } = await patternsModule();
    let settle: ((result: ConfirmResult) => void) | null = null;
    const onConfirm = vi.fn(
      async (_digest: string): Promise<ConfirmResult> =>
        await new Promise<ConfirmResult>((resolve) => {
          settle = resolve;
        }),
    );
    const Harness = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    const confirm = screen.getByTestId('consequence-confirm');
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Announced, not merely blocked: a control that has stopped answering says so (R-UI-012).
    expect(screen.getByTestId('consequence-confirm').getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      settle?.({ ok: true });
    });

    expect(screen.queryByTestId('consequence-dialog')).toBeNull();
  });
});

describe('ConsequenceDialog — the next confirm carries the digest on screen (L-ACT-02)', () => {
  it('confirms with stale.digest after a stale restatement', async () => {
    const { ConsequenceDialog } = await patternsModule();
    const onConfirm = vi.fn(
      async (digest: string): Promise<ConfirmResult> =>
        digest === PREVIEW.digest ? { ok: false, stale: STALE } : { ok: true },
    );
    const Harness = harness(ConsequenceDialog, onConfirm);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });
    expect(screen.getByTestId('consequence-dialog')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByTestId('consequence-confirm'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onConfirm.mock.calls[1]?.[0]).toBe(STALE.digest);
    // The second commit was accepted, so the dialog is gone.
    expect(screen.queryByTestId('consequence-dialog')).toBeNull();
  });
});
