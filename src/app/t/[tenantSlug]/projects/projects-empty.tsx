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
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../../ui/primitives';
import { SHELL_STATES, ShellAreaState } from '../../../../ui/shell';
import { ten } from '../../strings';

export function ProjectsEmptyState() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ShellAreaState
        state={SHELL_STATES.empty}
        title={ten('tenant.projects.empty.title')}
        teach={ten('tenant.projects.empty.teach')}
        actionLabel={ten('tenant.projects.empty.action')}
        onAction={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="tenant-projects-dialog">
          <DialogTitle>{ten('tenant.projects.create.title')}</DialogTitle>
          <DialogDescription>{ten('tenant.projects.create.body')}</DialogDescription>
          {/* D-02: the sample project is offered, not minted — and not today (§4). */}
          <p className="tenant-projects-sample">{ten('tenant.projects.create.sample')}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
