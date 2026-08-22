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
import { useRef, useState } from 'react';
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

/**
 * A whole number as the document writes it (R-SPINE-061), through the seam (L-FMT-01).
 * Rounded first: the seam takes exactly zero fraction digits for a count, so a line arriving
 * with `1.5` would throw from inside the dialog rather than render.
 */
function countText(value: number): string {
  return formatNumber(String(Math.round(value)), 'count');
}

/** What a stale preview replaced, and which of its lines are not what the reader read. */
interface Restated {
  /**
   * The digest of the preview this restatement answers — when the *server's state* moves on, so
   * does the dialog. The digest and not the object: a call site that writes
   * `consequence={{ digest, lines }}` inline hands over a new object on every parent render,
   * and a restatement discarded by an unrelated re-render would put the outdated preview back
   * on screen and carry a digest the server has already refused.
   */
  readonly base: string;
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
  const [failed, setFailed] = useState(false);

  // R-UI-012's "keyboard reachable", read to the end of the episode: this dialog is controlled
  // and renders no DialogTrigger of its own, so Radix's close handler prevents the focus
  // scope's restore and then focuses a trigger that does not exist — the reader is left on
  // `<body>` with their place gone. Refocusing from `onOpenChange` does not cure it, because
  // the scope unmounts after and takes the focus away again; `onCloseAutoFocus` is the one
  // moment Radix hands the decision over.
  //
  // The opener is read during the render that opens the dialog rather than from an effect:
  // the content's own mount effect is what moves the focus, and every effect of ours runs
  // after it, when the opener is no longer what is focused.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement ? active : null;
  }
  wasOpen.current = open;

  // A restatement belongs to the preview it answered: hand the dialog a *different* preview and
  // the stale one is gone, with no effect to run and nothing to reset.
  const current = restated !== null && restated.base === consequence.digest ? restated : null;
  const shown = current?.shown ?? consequence;
  const changed = current?.changed ?? new Set<string>();

  // Closing ends the episode: a dialog reopened on a preview that has since committed must not
  // greet the reader with the last refusal's notice.
  const close = (next: boolean): void => {
    if (!next) {
      setRestated(null);
      setFailed(false);
    }
    onOpenChange(next);
  };

  const confirm = (): void => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    void onConfirm(shown.digest)
      .then((result) => {
        if (result.ok) {
          close(false);
          return;
        }
        setRestated({
          base: consequence.digest,
          shown: result.stale,
          changed: changedKeys(shown, result.stale),
        });
      })
      .catch(() => {
        // The third outcome the typed contract does not name: the commit never answered. It is
        // still an answer the reader is owed — R-UI-020's "silence never happens" is exactly
        // the case where a button stops spinning and nothing is said (§9).
        setFailed(true);
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        data-testid="consequence-dialog"
        className="datum-consequence"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>

        {/* Said whenever the preview was restated, not only when a row changed: a line that
            vanished has no row left to mark, and the reader still has to be told (§9). */}
        {current === null ? null : (
          <p role={STATUS} className="datum-consequence-stale-note">
            {ps('patterns.consequence.stale')}
          </p>
        )}

        {/* The commit that never answered. `role="alert"`, not `status`: the reader pressed a
            button and it did not happen, which is the one thing here worth interrupting for. */}
        {failed ? (
          <p role="alert" className="datum-consequence-failed">
            {ps('patterns.consequence.failed')}
          </p>
        ) : null}

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
              close(false);
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
