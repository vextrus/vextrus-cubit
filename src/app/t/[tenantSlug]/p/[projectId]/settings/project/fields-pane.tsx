'use client';

/**
 * The project fields pane, as the reader works it (panes file §2).
 *
 * The form is s-home §5's, verbatim — same order, labels, pairing, test ids, validation and
 * error copy — prefilled with the saved values; only the footer differs, because saving an
 * existing project is not creating one. Above it sits the status row, whose archive control
 * changes visibility on S-Home and nothing else (Interpretation 10): the pane stays editable
 * while a project is archived, and the same control puts it back.
 *
 * Neither saving nor archiving is an act (Interpretation 1) — project metadata moves nothing
 * the machine derives — so there is no ConsequenceDialog here and no permission check outside
 * the seam. What guards the write is row-level security and the membership guard above.
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '../../../../../../../ui/primitives';
import {
  PROJECT_FIELD_TESTIDS,
  ProjectFormFields,
  firstInvalidField,
  validateProjectForm,
} from '../../../../../project-form';
import type { ProjectFormErrors, ProjectFormValues } from '../../../../../project-form';
import { REFUSALS } from '../../../../../../../core/errors';
import { around, fill, ten } from '../../../../../strings';
import { archiveProjectAction, updateProjectAction } from '../actions';

/** `data-status`, which is the machine's word for what the Badge says in the reader's. */
const ACTIVE = 'active';
const ARCHIVED = 'archived';

/** The slot the lead's own sentence keeps for the project's code. */
const NAME_SLOT = '{name}';

export interface ProjectFieldsView extends ProjectFormValues {
  readonly id: string;
  readonly archived: boolean;
}

export interface ProjectFieldsPaneProps {
  readonly tenantSlug: string;
  readonly project: ProjectFieldsView;
  /** The Interpretation 9 conversion of the *saved* GFA, or null when none is saved. */
  readonly gfaSftText: string | null;
}

export function ProjectFieldsPane({ tenantSlug, project, gfaSftText }: ProjectFieldsPaneProps) {
  const router = useRouter();
  const [values, setValues] = useState<ProjectFormValues>(project);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(project.archived);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState<keyof typeof REFUSALS | null>(null);
  const [announced, setAnnounced] = useState('');

  const change = useCallback((field: keyof ProjectFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field as keyof ProjectFormErrors] === undefined ? current : {}));
    // §2: "the next edit clears it" — a saved line above a changed field is a lie.
    setSaved(false);
    setFailed(false);
    setRefused(null);
  }, []);

  const save = useCallback(async () => {
    const found = validateProjectForm(values);
    setErrors(found);
    setSaved(false);
    setFailed(false);
    setRefused(null);
    const first = firstInvalidField(found);
    if (first !== null) {
      const control = document.querySelector(`[data-testid="${PROJECT_FIELD_TESTIDS[first]}"]`);
      if (control instanceof HTMLElement) control.focus();
      return;
    }
    setBusy(true);
    try {
      const outcome = await updateProjectAction(tenantSlug, project.id, values);
      if (!outcome.ok) {
        if (outcome.code === null) setFailed(true);
        else setRefused(outcome.code);
        return;
      }
      setSaved(true);
      // The sft line follows the saved value, so the pane re-reads the row rather than
      // recomputing it from what is in the fields.
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [project.id, router, tenantSlug, values]);

  const toggleArchive = useCallback(async () => {
    setFailed(false);
    setRefused(null);
    setSaved(false);
    setArchiving(true);
    const next = !archived;
    try {
      const outcome = await archiveProjectAction(tenantSlug, project.id, next);
      if (!outcome.ok) {
        if (outcome.code === null) setFailed(true);
        else setRefused(outcome.code);
        return;
      }
      setArchived(next);
      setAnnounced(ten(next ? 'project.fields.archivedDone' : 'project.fields.restoredDone'));
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setArchiving(false);
    }
  }, [archived, project.id, router, tenantSlug]);

  const [leadBefore, leadAfter] = around('project.fields.lead', 'code');
  const refusal = refused === null ? null : REFUSALS[refused];

  return (
    <div data-testid="project-settings-fields">
      <h1 className="tenant-title">{ten('project.fields.title')}</h1>
      <p className="tenant-lead">
        {leadBefore.split(NAME_SLOT).join(project.name)}
        <span className="project-card-code">{project.code}</span>
        {leadAfter}
      </p>

      <div className="project-status-row">
        <span className="project-status-label">{ten('project.fields.status')}</span>
        <Badge data-testid="project-status" data-status={archived ? ARCHIVED : ACTIVE}>
          {ten(archived ? 'project.home.status.archived' : 'project.home.status.active')}
        </Badge>
        <span className="project-status-right">
          <Button
            variant="secondary"
            data-testid="project-archive"
            loading={archiving}
            onClick={() => {
              void toggleArchive();
            }}
          >
            {ten(archived ? 'project.fields.restore' : 'project.fields.archive')}
          </Button>
        </span>
      </div>
      {archived ? (
        <p className="project-archived-note" role="status">
          {ten('project.fields.archivedNote')}
        </p>
      ) : null}

      <form
        data-testid="project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <ProjectFormFields
          values={values}
          errors={errors}
          onChange={change}
          busy={busy}
          gfaFooter={
            <p className="project-gfa-sft" data-testid="project-gfa-sft">
              {gfaSftText === null ? (
                ten('project.fields.gfaSftNone')
              ) : (
                <span className="numeric">{fill('project.fields.gfaSft', { sft: gfaSftText })}</span>
              )}
            </p>
          }
        />
        {refusal === null ? null : (
          <div className="project-refusal" role="alert" data-testid="participants-refusal">
            <p className="project-refusal-code" data-testid="refusal-code">
              {refusal.code}
            </p>
            <p className="project-refusal-message" data-testid="refusal-message">
              {refusal.message}
            </p>
            <p className="project-refusal-remedy" data-testid="refusal-remedy">
              {refusal.remedy}
            </p>
          </div>
        )}
        {failed ? (
          <p className="project-form-error" role="alert" data-testid="project-form-error">
            {ten('project.form.failed')}
          </p>
        ) : null}
        {saved ? (
          <p className="project-form-saved" role="status" data-testid="project-saved">
            {ten('project.fields.saved')}
          </p>
        ) : null}
        <div className="project-form-footer">
          <Button
            data-testid="project-save"
            loading={busy}
            onClick={() => {
              void save();
            }}
          >
            {ten('project.fields.save')}
          </Button>
        </div>
      </form>

      <div className="project-announce" role="status">
        {announced}
      </div>
    </div>
  );
}
