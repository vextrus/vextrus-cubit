'use client';

/**
 * The create form, as the route-driven Dialog Interpretation 2 decides
 * (docs/design/s-home.md §4, §5).
 *
 * The Dialog is open because the URL says `/projects/new`, and nothing else opens or closes it:
 * every way out — Escape, the scrim, Cancel, the corner close — navigates back to
 * `/t/{slug}/projects`, so the address and what is on screen can never disagree (R-UI-031).
 *
 * Interpretation 8: a route-driven Dialog has no Radix trigger to restore focus to, and Radix's
 * close handler focuses a `triggerRef` that is null here — which drops the reader on `<body>`
 * and makes them tab the whole shell again (R-UI-060, WCAG 2.4.3). So the default is prevented
 * and the create affordance of the page being returned to takes focus once it is there.
 *
 * Every exit closes the surface *first* and navigates afterwards, in an effect. A modal takes
 * the page's pointer events for itself while it is open and gives them back when it closes; a
 * navigation started in the same gesture can unmount the whole subtree before that cleanup
 * runs, and the page it lands on is then one no click reaches at all. Closing, committing the
 * close, and only then moving is the order that leaves nothing behind.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../../../ui/primitives';
import {
  EMPTY_PROJECT_FORM,
  PROJECT_FIELD_TESTIDS,
  ProjectFormFields,
  firstInvalidField,
  validateProjectForm,
} from '../../../project-form';
import type { ProjectFormErrors, ProjectFormValues } from '../../../project-form';
import { ten } from '../../../strings';
import { createProjectAction } from './actions';

/** The affordances the returned-to page offers, in the order Interpretation 8 prefers them. */
const RETURN_FOCUS = [
  '[data-testid="empty-state-action"]',
  '[data-testid="home-create-project"]',
] as const;

/** How many frames to keep looking for it while the navigation lands. */
const FOCUS_ATTEMPTS = 30;

/**
 * Did the reader arrive here from inside the app, so that going *back* returns them to it?
 *
 * `window.history.length` cannot answer this: it counts every entry in the tab, cross-origin
 * ones included, so a reader who followed the `/projects/new` link from anywhere else would be
 * navigated off the product by pressing Escape. What actually distinguishes the two cases is
 * whether this document was *loaded* at this address: a fresh GET has a navigation timing entry
 * whose URL is this one and nothing of ours behind it, while a client-side arrival left the
 * document at the address it was served for. Reading the entry rather than the counter keeps
 * the fallback honest, and its worst case — a reader who loaded this address, wandered off in
 * the app and came back — is a push to the projects area, which is inside the product.
 */
function arrivedFromInsideTheApp(): boolean {
  const [entry] = window.performance.getEntriesByType('navigation');
  if (entry === undefined) return false;
  try {
    return new URL(entry.name, window.location.href).pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

function focusCreateAffordance(attemptsLeft: number): void {
  const found = RETURN_FOCUS.map((selector) => document.querySelector(selector)).find(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
  if (found !== undefined) {
    found.focus();
    return;
  }
  if (attemptsLeft > 0) {
    window.requestAnimationFrame(() => focusCreateAffordance(attemptsLeft - 1));
  }
}

export interface CreateProjectDialogProps {
  readonly tenantSlug: string;
}

export function CreateProjectDialog({ tenantSlug }: CreateProjectDialogProps) {
  const router = useRouter();
  // The Dialog is open because the URL says so; it closes here first and navigates after, so
  // the exit is the surface's own and the address follows it in the same gesture.
  const [open, setOpen] = useState(true);
  /**
   * Where the closed Dialog goes. `null` is the ordinary exit — back to the address it was
   * opened from, by going *back*: a modal that lives at its own URL is one history step, and
   * an entry per open-and-close would make the browser's back button walk through dialogs
   * nobody opened twice (R-UI-031: "browser back works everywhere"). A string is the project
   * that was just created, which replaces the form rather than stacking on it.
   */
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [values, setValues] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (open) return;
    if (leavingTo !== null) {
      router.replace(leavingTo);
      return;
    }
    // A fresh GET of this address has nothing of ours behind it, so there is somewhere to go
    // back to only when the reader arrived here from inside the app.
    if (arrivedFromInsideTheApp()) router.back();
    else router.push(`/t/${tenantSlug}/projects`);
  }, [leavingTo, open, router, tenantSlug]);

  const change = useCallback((field: keyof ProjectFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field as keyof ProjectFormErrors] === undefined ? current : {}));
    setFailed(false);
  }, []);

  const submit = useCallback(async () => {
    const found = validateProjectForm(values);
    setErrors(found);
    setFailed(false);
    const first = firstInvalidField(found);
    if (first !== null) {
      // §5: "the first invalid field takes focus" — the reader is put where the work is.
      const control = document.querySelector(`[data-testid="${PROJECT_FIELD_TESTIDS[first]}"]`);
      if (control instanceof HTMLElement) control.focus();
      return;
    }
    setBusy(true);
    try {
      const outcome = await createProjectAction(tenantSlug, values);
      if (!outcome.ok) {
        setFailed(true);
        return;
      }
      // Interpretation 6: creation lands on the project's own fields pane — the saved values
      // on screen are the confirmation.
      setLeavingTo(`/t/${tenantSlug}/p/${outcome.projectId}/settings/project`);
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [tenantSlug, values]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        className="project-dialog"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusCreateAffordance(FOCUS_ATTEMPTS);
        }}
      >
        <DialogTitle>{ten('tenant.projects.create.title')}</DialogTitle>
        <DialogDescription>{ten('tenant.projects.create.body')}</DialogDescription>
        <form
          className="project-form"
          data-testid="project-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <ProjectFormFields values={values} errors={errors} onChange={change} busy={busy} />
          {failed ? (
            <p className="project-form-error" role="alert" data-testid="project-form-error">
              {ten('project.form.failed')}
            </p>
          ) : null}
          <div className="project-form-footer">
            <Button variant="secondary" onClick={close}>
              {ten('project.form.cancel')}
            </Button>
            {/* The form's own submit control, so Enter in any field creates the project the
                way a reader of a nine-field form expects. Datum's Button is a `type="button"`
                by default (a primitive that submits by accident writes a document by accident),
                so this one says what it is; the work is the form's `onSubmit`, once, and the
                primitive's loading guard still refuses the second activation. */}
            <Button data-testid="project-submit" type="submit" loading={busy}>
              {ten('project.form.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
