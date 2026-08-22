/**
 * ConsequenceDialog — what an irreversible act would do, before it is done (§5). Drawn closed.
 *
 * The dialog is controlled and renders no trigger of its own, so on close Radix returns focus
 * to nothing and it lands on `<body>`; the sample refocuses its own button (R-UI-012, and the
 * standing lesson from inc-007's controlled dialogs).
 */
'use client';
import type { ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '../../primitives';
import { ConsequenceDialog } from '../../patterns';
import type { Consequence, ConfirmResult } from '../../patterns';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** The digest of the shown consequence: an opaque code, fixed so the sample is deterministic. */
const DIGEST = 'CONS-0001';

/** The two lines' keys — identifiers the dialog diffs on, not words anybody reads. */
const VOIDED = 'voided';
const REOPENED = 'reopened';

const VOIDED_COUNT = 3;
const REOPENED_COUNT = 14;

const consequence = (): Consequence => ({
  digest: DIGEST,
  lines: [
    { key: VOIDED, label: gs('gallery.sample.consequence-dialog.voided'), count: VOIDED_COUNT },
    {
      key: REOPENED,
      label: gs('gallery.sample.consequence-dialog.reopened'),
      count: REOPENED_COUNT,
    },
  ],
});

const confirm = (): Promise<ConfirmResult> => Promise.resolve({ ok: true });

function Sample(): ReactElement {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const change = useCallback((next: boolean): void => {
    setOpen(next);
    if (!next) trigger.current?.focus();
  }, []);

  return (
    <span className="datum-gallery-row">
      <Button ref={trigger} variant="danger" onClick={() => setOpen(true)}>
        {gs('gallery.sample.consequence-dialog.trigger')}
      </Button>
      <ConsequenceDialog
        open={open}
        onOpenChange={change}
        title={gs('gallery.sample.consequence-dialog.title')}
        consequence={consequence()}
        onConfirm={confirm}
      />
    </span>
  );
}

export const entry: GalleryEntry = {
  id: 'consequence-dialog',
  covers: ['ConsequenceDialog'],
  states: [{ name: 'default', render: () => <Sample /> }],
};
