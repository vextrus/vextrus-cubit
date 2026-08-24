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
 */
import { useCallback, useState } from 'react';
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
  const [values, setValues] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    router.push(`/t/${tenantSlug}/projects`);
  }, [router, tenantSlug]);

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
      router.push(`/t/${tenantSlug}/p/${outcome.projectId}/settings/project`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [router, tenantSlug, values]);

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
            <Button
              data-testid="project-submit"
              loading={busy}
              onClick={() => {
                void submit();
              }}
            >
              {ten('project.form.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
