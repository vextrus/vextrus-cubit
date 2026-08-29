"use client";
// The project form (R-SPINE-010): one component serving create and edit, because the fields a
// project carries are the same fields whichever door was taken. `perform` replaces the server action
// and nothing else — given one, the form maps the settlement exactly as it maps the real one, which
// is what makes the screen a browser renders and the form a test renders the same component (the
// SignInForm precedent).
//
// I-31: creation is a plain write, never an act. Nothing here wears copper, nothing carries a
// digest, and no ConsequenceDialog stands between the person and the save.
import { useActionState, useEffect, useId, useState } from "react";
import { refusalOf, type RefusalCode } from "../../../../../core/errors";
import { formatSquareFeet } from "../../../../../core/format";
import { BUILDING_TYPES, type BuildingType, type Project } from "../../../../../modules/spine/projects";
import { RefusalState } from "../../../../../ui/patterns/refusal-state";
import { Button, Chip, Input, Textarea, UnitBadge } from "../../../../../ui/primitives/core";
import { shellHref } from "../../../../../ui/shell";
import { strings, type StringKey } from "../../../../../ui/strings";
import { saveProjectAction, type ProjectFormState } from "../actions";
import { isPlainDecimal, judgeProject, presentedProject, type ProjectJudgement } from "./judgement";

/** The unit the readout is stated in — a source key, carried verbatim by the shipped badge. */
const SFT = "sft";

/** I-33: the label is prose and the enum value travels in the hidden input. */
const BUILDING_TYPE_LABEL: Readonly<Record<BuildingType, StringKey>> = {
  residential: "home_building_type_residential",
  commercial: "home_building_type_commercial",
  mixed: "home_building_type_mixed",
  industrial: "home_building_type_industrial",
  infrastructure: "home_building_type_infrastructure",
};

/** I-34's three judgements, each with the one sentence the answer slot states it in. */
const JUDGEMENT_COPY: Readonly<Record<ProjectJudgement, StringKey>> = {
  name: "home_form_name_refusal",
  buildingType: "home_form_type_refusal",
  number: "home_form_number_refusal",
};

export interface ProjectFormProps {
  tenantId: string;
  /** The project being edited, or null on the create path. */
  project?: Project | null;
  /** Called when the form is finished with — a submission saved, or the person cancelling. */
  onClose?: () => void;
  perform?: (shown: ProjectFormState, form: FormData) => Promise<ProjectFormState>;
}

export function ProjectForm({ tenantId, project = null, onClose, perform }: ProjectFormProps) {
  const [answer, submit, pending] = useActionState<ProjectFormState, FormData>(perform ?? saveProjectAction, null);
  // What this form judged of the last submission it did NOT send. A judgement describes a
  // submission, so it is spent the moment the person states a new intention by submitting again.
  const [refusedLocally, setRefusedLocally] = useState<ProjectJudgement | null>(null);
  const [buildingType, setBuildingType] = useState<string>(project?.buildingType ?? "");
  const [gfaM2, setGfaM2] = useState<string>(project?.targetGfaM2 ?? "");
  const gfaHintId = useId();
  const sftId = useId();

  const saved = answer !== null && answer.saved;
  useEffect(() => {
    if (saved) onClose?.();
  }, [saved, onClose]);

  // In flight the slot is empty: `useActionState` keeps the last answer for the whole pending
  // window, and leaving it painted would tell a person that the submission they are waiting on is
  // already refused.
  const settled = pending ? null : answer;
  const refusal = settled !== null && !settled.saved && "refusal" in settled ? settled.refusal : null;
  const judgement = pending ? null : (refusedLocally ?? (settled !== null && !settled.saved && "judgement" in settled ? settled.judgement : null));

  return (
    <>
      <h2 className="cx-home-form-heading">
        {project === null ? strings.home_form_create_heading : strings.home_form_edit_heading}
      </h2>
      <form
        className="cx-home-form"
        data-testid="project-form"
        action={(data: FormData) => {
          // I-34: the form judges before the seam is called, so a blank name or an unchosen type is
          // answered here and nothing is sent. The taxonomy stays closed (R-SPINE-062).
          const judged = judgeProject(presentedProject(data));
          setRefusedLocally(judged.presentable ? null : judged.refused);
          if (judged.presentable) submit(data);
        }}
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="projectId" value={project?.projectId ?? ""} />

        <Field label="home_field_name" testId="project-name" name="name" defaultValue={project?.name ?? ""} busy={pending} />
        <Field label="home_field_code" testId="project-code" name="code" defaultValue={project?.code ?? ""} busy={pending} />
        <Field label="home_field_client" testId="project-client" name="client" defaultValue={project?.client ?? ""} busy={pending} />
        <Field label="home_field_site_address" testId="project-site-address" name="siteAddress" defaultValue={project?.siteAddress ?? ""} busy={pending} />
        <Field label="home_field_district" testId="project-district" name="district" defaultValue={project?.district ?? ""} busy={pending} />

        {/* I-33: no Select ships and a native one could not wear the reticle, so the five are
            interactive Chips in a fieldset — exactly one pressed — and a hidden input carries the
            chosen value into the native form. */}
        <fieldset className="cx-home-types" data-testid="project-building-type">
          <legend className="cx-home-field-label">{strings.home_field_building_type}</legend>
          <div className="cx-home-types-choices">
            {BUILDING_TYPES.map((type) => (
              <Chip key={type} selected={buildingType === type} onClick={() => setBuildingType(type)}>
                {strings[BUILDING_TYPE_LABEL[type]]}
              </Chip>
            ))}
          </div>
          <input type="hidden" name="buildingType" value={buildingType} />
        </fieldset>

        <Field label="home_field_storeys" testId="project-storeys" name="storeys" defaultValue={String(project?.storeys ?? "")} busy={pending} inputMode="numeric" />

        <div className="cx-home-field">
          <label className="cx-home-field-label" htmlFor={`${sftId}-gfa`}>
            {strings.home_field_gfa}
          </label>
          <p className="cx-home-field-hint" id={gfaHintId}>
            {strings.home_field_gfa_hint}
          </p>
          <Input
            id={`${sftId}-gfa`}
            name="gfaM2"
            data-testid="project-gfa-m2"
            inputMode="decimal"
            value={gfaM2}
            aria-describedby={gfaHintId}
            readOnly={pending}
            aria-busy={pending || undefined}
            onChange={(event) => setGfaM2(event.currentTarget.value)}
          />
          {/* I-39: the sft figure is a conversion, not a second field — and it renders nothing at
              all while the m² input holds no value the seam would read as an area. */}
          <output className="cx-home-sft" data-testid="project-gfa-sft" htmlFor={`${sftId}-gfa`}>
            {isPlainDecimal(gfaM2) ? (
              <>
                {formatSquareFeet(gfaM2)}
                <UnitBadge unit={SFT} />
              </>
            ) : null}
          </output>
        </div>

        <div className="cx-home-field">
          <label className="cx-home-field-label" htmlFor={`${sftId}-notes`}>
            {strings.home_field_notes}
          </label>
          <Textarea id={`${sftId}-notes`} name="notes" data-testid="project-notes" rows={3} defaultValue={project?.notes ?? ""} readOnly={pending} aria-busy={pending || undefined} />
        </div>

        {/* The answer slot, before the submit: exactly one of the judged sentence and a settled
            refusal stands in it, and in flight neither does. */}
        <div data-testid="project-form-refusal">
          {judgement !== null ? (
            <p className="cx-home-alert" role="alert">
              {strings[JUDGEMENT_COPY[judgement]]}
            </p>
          ) : null}
          {refusal !== null ? <RefusalState refusal={refusalOf(refusal)} evidence={evidenceFor(refusal, tenantId)} /> : null}
        </div>

        <div className="cx-home-form-footer">
          <Button type="submit" data-testid="project-form-submit" loading={pending}>
            {project === null ? strings.home_form_submit_create : strings.home_form_submit_save}
          </Button>
          <Button variant="secondary" onClick={() => onClose?.()}>
            {strings.home_form_cancel}
          </Button>
        </div>
      </form>
    </>
  );
}

/** One label-over-control field, in the idiom every form of this product uses (s-auth's § 1). */
function Field({
  label,
  testId,
  name,
  defaultValue,
  busy,
  inputMode,
}: {
  label: StringKey;
  testId: string;
  name: string;
  defaultValue: string;
  busy: boolean;
  inputMode?: "numeric" | "decimal";
}) {
  const id = useId();
  return (
    <div className="cx-home-field">
      <label className="cx-home-field-label" htmlFor={id}>
        {strings[label]}
      </label>
      {/* In flight the field is read-only rather than disabled: disabling the focused element would
          remove it from the tab order and drop focus to the document body (the shell's ruling). */}
      <Input id={id} name={name} data-testid={testId} defaultValue={defaultValue} inputMode={inputMode} readOnly={busy} aria-busy={busy || undefined} />
    </div>
  );
}

/**
 * Where each refusal this form can answer with is resolved: a session that ended is resolved at
 * sign-in, and a project this person holds no participation on is resolved back on the workspace's
 * own home, which is where the projects they do hold stand.
 */
function evidenceFor(code: RefusalCode, tenantId: string): { href: string; label: string } {
  return code === "SIGNED_OUT" ? { href: "/sign-in", label: strings.shell_evidence_sign_in } : { href: shellHref(tenantId, "projects"), label: strings.home_evidence_projects };
}
