/**
 * ConsequenceDialog — preview → digest → confirm (R-UI-021, L-ACT-02).
 *
 * R-UI-021: "every act opens a ConsequenceDialog showing the typed consequence (counts of rows
 * affected, signatures voided, denominators widened) computed by the server; confirm carries
 * the digest; a stale digest re-renders the dialog with what changed."
 *
 * Two rules hold this component to that sentence:
 *
 *   1. **It never computes a count.** The lines arrive typed from the server's preview and are
 *      written down. A dialog that derived a number would be showing a consequence nobody
 *      committed to, which is the failure L-ACT-02 exists to prevent.
 *   2. **Confirm carries the digest of what is on screen.** After a `{ ok: false, stale }` the
 *      lines are re-rendered from `stale` and the next confirm carries `stale.digest` — the
 *      reader confirms what they are looking at now, never what they were looking at before.
 *      A refused commit is therefore a thing to read, not a dialog that vanishes.
 *
 * The server half — computing the Consequence, and the CONSEQUENCES_NOT_CARRIED refusal a
 * commit with the wrong digest earns — is another leaf's. This is the client contract only.
 *
 * Decided in docs/design/datum-patterns.md §9.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../primitives/dialog';
import { Button } from '../primitives/button';
import { cx } from '../primitives/class-names';
import { formatNumber } from '../../core/format';
import { ps } from './strings';

/** One typed count the act will have (§9). The UI writes it down; it never derives it. */
export interface ConsequenceLine {
  /** What this line is about, stable across previews — how "changed" is decided. */
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

/** A preview: what the act would do, and the digest of the state it was computed against. */
export interface Consequence {
  readonly digest: string;
  readonly lines: readonly ConsequenceLine[];
}

/** What a commit answers: it happened, or the world moved and here is what it looks like now. */
export type ConfirmResult = { ok: true } | { ok: false; stale: Consequence };

export interface ConsequenceDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The act, named as the reader would name it. */
  readonly title: string;
  /** The server's preview. */
  readonly consequence: Consequence;
  /** Commit, carrying the digest of what is displayed (L-ACT-02). */
  readonly onConfirm: (digest: string) => Promise<ConfirmResult>;
}

/** ARIA's own vocabulary for a region that announces without stealing focus. */
const STATUS = 'status';

/** A whole number as the document writes it (R-SPINE-061), through the seam (L-FMT-01). */
function countText(value: number): string {
  return formatNumber(String(value), 'count');
}

/** What a stale preview replaced, and which of its lines are not what the reader read. */
interface Restated {
  /** The preview this restatement answers — when the prop moves on, so does the dialog. */
  readonly base: Consequence;
  readonly shown: Consequence;
  readonly changed: ReadonlySet<string>;
}

/**
 * The keys that say something different now: a count that moved, or a line that arrived. A
 * line that vanished is covered by the status sentence above the list — it has no row left to
 * mark.
 */
function changedKeys(before: Consequence, after: Consequence): ReadonlySet<string> {
  const previous = new Map(before.lines.map((line) => [line.key, line.count]));
  const moved = new Set<string>();
  for (const line of after.lines) {
    const was = previous.get(line.key);
    if (was === undefined || was !== line.count) moved.add(line.key);
  }
  return moved;
}

export function ConsequenceDialog({
  open,
  onOpenChange,
  title,
  consequence,
  onConfirm,
}: ConsequenceDialogProps): ReactElement {
  const [restated, setRestated] = useState<Restated | null>(null);
  const [busy, setBusy] = useState(false);

  // A restatement belongs to the preview it answered: hand the dialog a new `consequence` and
  // the stale one is gone, with no effect to run and nothing to reset.
  const current = restated !== null && restated.base === consequence ? restated : null;
  const shown = current?.shown ?? consequence;
  const changed = current?.changed ?? new Set<string>();

  const confirm = (): void => {
    if (busy) return;
    setBusy(true);
    void onConfirm(shown.digest)
      .then((result) => {
        if (result.ok) {
          onOpenChange(false);
          return;
        }
        setRestated({
          base: consequence,
          shown: result.stale,
          changed: changedKeys(shown, result.stale),
        });
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="consequence-dialog" className="datum-consequence">
        <DialogTitle>{title}</DialogTitle>

        {changed.size === 0 ? null : (
          <p role={STATUS} className="datum-consequence-stale-note">
            {ps('patterns.consequence.stale')}
          </p>
        )}

        <ul className="datum-consequence-lines">
          {shown.lines.map((line) => {
            const moved = changed.has(line.key);
            return (
              <li
                key={line.key}
                data-testid="consequence-line"
                data-changed={moved ? '' : undefined}
                className="datum-consequence-line"
              >
                <span className="datum-consequence-label">{line.label}</span>
                <span
                  data-testid={moved ? 'consequence-stale' : undefined}
                  className={cx('datum-consequence-count', 'numeric', moved && 'datum-changed')}
                >
                  {countText(line.count)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="datum-consequence-actions">
          {/* Cancel never calls onConfirm — neither does Escape, which Radix routes to the
              same close (§9). */}
          <Button
            variant="secondary"
            data-testid="consequence-cancel"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {ps('patterns.consequence.cancel')}
          </Button>
          <Button
            variant="primary"
            data-testid="consequence-confirm"
            loading={busy}
            onClick={confirm}
          >
            {ps('patterns.consequence.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
