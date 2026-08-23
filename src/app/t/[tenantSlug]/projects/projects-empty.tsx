'use client';

/**
 * Projects' empty state, and the honest dialog behind its action (docs/design/shell.md §4,
 * Interpretation 6).
 *
 * R-UI-033 asks the empty state to teach the next action, and the true next action is creating
 * a project and uploading a drawing. Project creation is the projects increment's, so the
 * affordance still exists and still answers — it opens a dialog that says plainly what it
 * cannot do yet and what a project will start with, rather than being a control that does
 * nothing (R-UI-020: silence never happens).
 */
import { useCallback, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../../ui/primitives';
import { SHELL_STATES, ShellAreaState } from '../../../../ui/shell';
import { ten } from '../../strings';

/** The empty state's action, by the test id the patterns register gives it (C-05). */
const ACTION_SELECTOR = '[data-testid="empty-state-action"]';

export function ProjectsEmptyState() {
  const [open, setOpen] = useState(false);
  /**
   * The control the dialog was opened from, remembered so it can be given focus back.
   *
   * This dialog is opened from the EmptyState's own action rather than from a
   * `DialogTrigger`, and Radix restores focus only to a trigger it rendered itself: its
   * close handler prevents FocusScope's fallback and then focuses a `triggerRef` that is
   * null here, so a reader who presses Escape is dropped on `<body>` and has to tab the
   * whole shell again (R-UI-060 keyboard operability, WCAG 2.4.3 focus order). Preventing
   * that same default ourselves and focusing the opener puts the reader back where they
   * pressed — for Escape, the scrim and the close control alike.
   */
  const opener = useRef<HTMLElement | null>(null);
  /** The empty state itself, so the action can be found again if nothing held focus. */
  const region = useRef<HTMLDivElement>(null);

  const restoreFocus = useCallback((event: Event) => {
    event.preventDefault();
    const back = opener.current ?? region.current?.querySelector(ACTION_SELECTOR);
    if (back instanceof HTMLElement) back.focus();
  }, []);

  return (
    <div ref={region}>
      <ShellAreaState
        state={SHELL_STATES.empty}
        title={ten('tenant.projects.empty.title')}
        teach={ten('tenant.projects.empty.teach')}
        actionLabel={ten('tenant.projects.empty.action')}
        onAction={() => {
          const active = document.activeElement;
          opener.current =
            active instanceof HTMLElement && active !== document.body ? active : null;
          setOpen(true);
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="tenant-projects-dialog" onCloseAutoFocus={restoreFocus}>
          <DialogTitle>{ten('tenant.projects.create.title')}</DialogTitle>
          <DialogDescription>{ten('tenant.projects.create.body')}</DialogDescription>
          {/* D-02: the sample project is offered, not minted — and not today (§4). */}
          <p className="tenant-projects-sample">{ten('tenant.projects.create.sample')}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
