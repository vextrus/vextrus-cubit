'use client';

/**
 * R-SPINE-010's fields, said once (docs/design/s-home.md §5).
 *
 * The create Dialog and the project-settings fields pane render the same nine fields in the
 * same order, with the same labels, pairing, test ids, validation rules and error copy — the
 * panes file says so verbatim ("s-home §5's fields verbatim"), and a second copy of them would
 * be a second thing to keep true. So the field set lives here, above both routes, and each
 * screen supplies the footer that makes it a create form or a save form.
 *
 * Recorded interpretation — **storeys and target GFA are plain decimal Inputs, not the Datum
 * `NumberInput`.** The primitive groups its value through the format seam while it is at rest
 * (`1000` reads `1,000`), and the increment's page object reads the field back as the exact
 * decimal the reader typed: a grouped field would answer with a value nobody entered. The unit
 * still renders beside the number and never inside it (L-FMT-02), the field stays `numeric`
 * and `inputMode="decimal"`, and the grouping that R-SPINE-061 legislates is done where a
 * *reader* meets a number — the GFA's sft line, the card's counts — through the seam and
 * nowhere else. No float exists on this path: every value here is the string that was typed.
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import './projects.css';
import { BUILDING_TYPES } from '../../modules/spine/projects/building-types';
import { ten } from './strings';
import type { TenantStringKey } from './strings';

/** The nine values a project form holds, all of them text — a quantity is a string (B-07). */
export interface ProjectFormValues {
  readonly name: string;
  readonly code: string;
  readonly client: string;
  readonly siteAddress: string;
  readonly district: string;
  readonly buildingType: string;
  readonly storeys: string;
  readonly gfaM2: string;
  readonly notes: string;
}

/** An untouched form: every field empty, which is what "optional" means here. */
export const EMPTY_PROJECT_FORM: ProjectFormValues = Object.freeze({
  name: '',
  code: '',
  client: '',
  siteAddress: '',
  district: '',
  buildingType: '',
  storeys: '',
  gfaM2: '',
  notes: '',
});

/** Which fields can be wrong, and what each says when it is (§5). */
export type ProjectFormErrors = Partial<Record<'name' | 'code' | 'storeys', TenantStringKey>>;

/** The order the first invalid field takes focus in (§5). */
const FIELD_ORDER: readonly (keyof ProjectFormErrors)[] = ['name', 'code', 'storeys'];

/** A whole number and nothing else — a fraction of a storey is not a storey. */
const WHOLE = /^\d+$/;

/**
 * §5's validation, client-side, before any request is made.
 *
 * Name and code are required because a project is citable by them from birth (Interpretation
 * 3); everything else is optional, and an optional field that is empty is not an error.
 */
export function validateProjectForm(values: ProjectFormValues): ProjectFormErrors {
  const errors: {
    name?: TenantStringKey;
    code?: TenantStringKey;
    storeys?: TenantStringKey;
  } = {};
  if (values.name.trim() === '') errors.name = 'project.form.nameRequired';
  if (values.code.trim() === '') errors.code = 'project.form.codeRequired';
  const storeys = values.storeys.trim();
  if (storeys !== '' && !WHOLE.test(storeys)) errors.storeys = 'project.form.storeysWhole';
  return errors;
}

/** The first field a reader has to go back to, or null when the form is good (§5). */
export function firstInvalidField(errors: ProjectFormErrors): keyof ProjectFormErrors | null {
  return FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

/** The test id each field carries, from the increment's test contract (C-05). */
export const PROJECT_FIELD_TESTIDS = Object.freeze({
  name: 'project-field-name',
  code: 'project-field-code',
  client: 'project-field-client',
  siteAddress: 'project-field-site-address',
  district: 'project-field-district',
  buildingType: 'project-field-building-type',
  storeys: 'project-field-storeys',
  gfaM2: 'project-field-gfa-m2',
  notes: 'project-field-notes',
});

/** The label above each building-type option, by the value the column stores verbatim. */
const BUILDING_TYPE_LABELS: Readonly<Record<string, TenantStringKey>> = Object.freeze({
  residential: 'project.buildingType.residential',
  commercial: 'project.buildingType.commercial',
  mixed: 'project.buildingType.mixed',
  industrial: 'project.buildingType.industrial',
  infrastructure: 'project.buildingType.infrastructure',
});

/** §5: the validation line under a field, in the danger voice, with `aria-invalid` above it. */
function FieldError({ id, message }: { readonly id: string; readonly message: string }) {
  return (
    <p className="project-field-error" id={id} role="alert">
      {message}
    </p>
  );
}

export interface ProjectFormFieldsProps {
  readonly values: ProjectFormValues;
  readonly errors: ProjectFormErrors;
  readonly onChange: (field: keyof ProjectFormValues, value: string) => void;
  /** Whether the whole set is waiting on a request — every control goes quiet together. */
  readonly busy?: boolean;
  /**
   * Rendered directly under the target-GFA field. The fields pane puts the sft conversion of
   * the *saved* value there (panes file §2); the create form has no saved value yet and puts
   * nothing.
   */
  readonly gfaFooter?: ReactNode;
}

export function ProjectFormFields({
  values,
  errors,
  onChange,
  busy,
  gfaFooter,
}: ProjectFormFieldsProps) {
  const prefix = useId();
  const at = (field: string): string => `${prefix}-${field}`;
  const errorAt = (field: string): string => `${prefix}-${field}-error`;

  return (
    <div className="project-form-rows">
      <div className="project-form-row">
        <label className="project-form-label" htmlFor={at('name')}>
          {ten('project.form.name')}
        </label>
        <input
          id={at('name')}
          data-testid={PROJECT_FIELD_TESTIDS.name}
          className="datum-control datum-field datum-focus-ring"
          type="text"
          autoComplete="off"
          disabled={busy === true}
          aria-invalid={errors.name !== undefined}
          aria-describedby={errors.name === undefined ? undefined : errorAt('name')}
          value={values.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
        {errors.name === undefined ? null : (
          <FieldError id={errorAt('name')} message={ten(errors.name)} />
        )}
      </div>

      <div className="project-form-pair">
        <div className="project-form-row">
          <label className="project-form-label" htmlFor={at('code')}>
            {ten('project.form.code')}
          </label>
          <input
            id={at('code')}
            data-testid={PROJECT_FIELD_TESTIDS.code}
            className="datum-control datum-field datum-focus-ring project-field-code"
            type="text"
            autoComplete="off"
            disabled={busy === true}
            aria-invalid={errors.code !== undefined}
            aria-describedby={errors.code === undefined ? undefined : errorAt('code')}
            value={values.code}
            onChange={(event) => onChange('code', event.target.value)}
          />
          {errors.code === undefined ? null : (
            <FieldError id={errorAt('code')} message={ten(errors.code)} />
          )}
        </div>
        <div className="project-form-row">
          <label className="project-form-label" htmlFor={at('client')}>
            {ten('project.form.client')}
          </label>
          <input
            id={at('client')}
            data-testid={PROJECT_FIELD_TESTIDS.client}
            className="datum-control datum-field datum-focus-ring"
            type="text"
            autoComplete="off"
            disabled={busy === true}
            value={values.client}
            onChange={(event) => onChange('client', event.target.value)}
          />
        </div>
      </div>

      <div className="project-form-row">
        <label className="project-form-label" htmlFor={at('siteAddress')}>
          {ten('project.form.siteAddress')}
        </label>
        <input
          id={at('siteAddress')}
          data-testid={PROJECT_FIELD_TESTIDS.siteAddress}
          className="datum-control datum-field datum-focus-ring"
          type="text"
          autoComplete="off"
          disabled={busy === true}
          value={values.siteAddress}
          onChange={(event) => onChange('siteAddress', event.target.value)}
        />
      </div>

      <div className="project-form-pair">
        <div className="project-form-row">
          <label className="project-form-label" htmlFor={at('district')}>
            {ten('project.form.district')}
          </label>
          <input
            id={at('district')}
            data-testid={PROJECT_FIELD_TESTIDS.district}
            className="datum-control datum-field datum-focus-ring"
            type="text"
            autoComplete="off"
            disabled={busy === true}
            value={values.district}
            onChange={(event) => onChange('district', event.target.value)}
          />
        </div>
        <div className="project-form-row">
          <label className="project-form-label" htmlFor={at('buildingType')}>
            {ten('project.form.buildingType')}
          </label>
          {/*
            A native select wearing the Datum control surface, the idiom
            `src/app/t/[tenantSlug]/(area)/settings/tenant-admin.tsx` established: the five
            values of a closed enum have to be in the document the server sends, and a Radix
            Select mounts its options only while it is open. The keyboard behaviour, the
            accessible name and the tokens are the primitive's.
          */}
          <select
            id={at('buildingType')}
            data-testid={PROJECT_FIELD_TESTIDS.buildingType}
            className="datum-control datum-select-trigger datum-focus-ring"
            disabled={busy === true}
            value={values.buildingType}
            onChange={(event) => onChange('buildingType', event.target.value)}
          >
            <option value="">{ten('project.form.buildingTypePlaceholder')}</option>
            {BUILDING_TYPES.map((type) => (
              <option key={type} value={type}>
                {ten(BUILDING_TYPE_LABELS[type] ?? 'project.form.buildingTypePlaceholder')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="project-form-pair">
        <div className="project-form-row">
          <label className="project-form-label" htmlFor={at('storeys')}>
            {ten('project.form.storeys')}
          </label>
          <input
            id={at('storeys')}
            data-testid={PROJECT_FIELD_TESTIDS.storeys}
            className="datum-control datum-field datum-focus-ring numeric"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={busy === true}
            aria-invalid={errors.storeys !== undefined}
            aria-describedby={errors.storeys === undefined ? undefined : errorAt('storeys')}
            value={values.storeys}
            onChange={(event) => onChange('storeys', event.target.value)}
          />
          {errors.storeys === undefined ? null : (
            <FieldError id={errorAt('storeys')} message={ten(errors.storeys)} />
          )}
        </div>
        <div className="project-form-row">
          <label className="project-form-label" htmlFor={at('gfaM2')}>
            {ten('project.form.gfaM2')}
          </label>
          <div className="project-form-unit-row">
            <input
              id={at('gfaM2')}
              data-testid={PROJECT_FIELD_TESTIDS.gfaM2}
              className="datum-control datum-field datum-focus-ring numeric"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              disabled={busy === true}
              aria-describedby={at('gfaM2-unit')}
              value={values.gfaM2}
              onChange={(event) => onChange('gfaM2', event.target.value)}
            />
            <span className="project-form-unit" id={at('gfaM2-unit')}>
              {ten('project.form.unitM2')}
            </span>
          </div>
          {gfaFooter}
        </div>
      </div>

      <div className="project-form-row">
        <label className="project-form-label" htmlFor={at('notes')}>
          {ten('project.form.notes')}
        </label>
        <textarea
          id={at('notes')}
          data-testid={PROJECT_FIELD_TESTIDS.notes}
          className="datum-control datum-field datum-textarea datum-focus-ring"
          rows={3}
          disabled={busy === true}
          value={values.notes}
          onChange={(event) => onChange('notes', event.target.value)}
        />
      </div>
    </div>
  );
}
