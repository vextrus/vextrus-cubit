"use client";
// The project form (R-SPINE-010): one component serving create and edit, because the fields a
// project carries are the same fields whichever door was taken. `perform` replaces the server action
// and nothing else — given one, the form maps the settlement exactly as it maps the real one, which
// is what makes the screen a browser renders and the form a test renders the same component (the
// SignInForm precedent).
//
// I-31: creation is a plain write, never an act. Nothing here wears copper, nothing carries a
// digest, and no ConsequenceDialog stands between the person and the save.
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { refusalOf, type RefusalCode } from "../../../../../core/errors";
import { formatSquareFeet } from "../../../../../core/format";
import { BUILDING_TYPES, type BuildingType } from "../../../../../core/projects";
import type { Project } from "../../../../../modules/spine/projects";
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
  // How many submissions this form has made. A judgement is about ONE submission, so pressing the
  // door again is a new event even when it is refused for the identical reason: without this the
  // state set from the second attempt is the string already held, React bails out, and the effect
  // below — the whole mechanism of sending somebody back to the offending field — never re-runs.
  const [attempt, setAttempt] = useState(0);
  const [buildingType, setBuildingType] = useState<string>(project?.buildingType ?? "");
  const [gfaM2, setGfaM2] = useState<string>(project?.targetGfaM2 ?? "");
  const gfaHintId = useId();
  const alertId = useId();
  const sftId = useId();
  const formRef = useRef<HTMLFormElement>(null);

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

  // A judged submission sends the person back to the field that stopped it. The sheet is a scrolling
  // column and the answer slot sits at the far end of it, so an alert alone can settle below the
  // fold with nothing saying which of nine fields is meant: focus is both the pointer and the way
  // back into the form, and the browser scrolls what it focuses into view (§2's refusal cell). The
  // field also STATES that it is the judged one — `aria-invalid` and the alert as its description —
  // so a reader who arrives there by focus is told what focus alone cannot say.
  const offending = judgement === null ? null : offendingField(judgement, gfaM2);
  useEffect(() => {
    if (offending === null) return;
    const control = formRef.current?.querySelector<HTMLElement>(`[data-testid="${offending}"]`) ?? null;
    // The building type is a fieldset, which takes no focus of its own — the first chip is what a
    // person would reach for it with, and it is what the tab order already holds.
    const focusable = control?.tagName === "FIELDSET" ? control.querySelector<HTMLElement>("button") : control;
    focusable?.focus();
    // `attempt`, not the answer: a second submission refused for the same reason is a second event,
    // and it earns the same way back into the form as the first one did.
  }, [offending, attempt]);

  /** The alert's id on the field this judgement is about, and nothing on any other field. */
  const invalidBy = (testId: string): string | null => (offending === testId ? alertId : null);

  return (
    <>
      <h2 className="cx-home-form-heading">
        {project === null ? strings.home_form_create_heading : strings.home_form_edit_heading}
      </h2>
      <form
        ref={formRef}
        className="cx-home-form"
        data-testid="project-form"
        action={(data: FormData) => {
          // I-34: the form judges before the seam is called, so a blank name or an unchosen type is
          // answered here and nothing is sent. The taxonomy stays closed (R-SPINE-062).
          const judged = judgeProject(presentedProject(data));
          setAttempt((made) => made + 1);
          setRefusedLocally(judged.presentable ? null : judged.refused);
          if (judged.presentable) submit(data);
        }}
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="projectId" value={project?.projectId ?? ""} />

        <Field label="home_field_name" testId="project-name" name="name" defaultValue={project?.name ?? ""} busy={pending} invalidBy={invalidBy("project-name")} />
        <Field label="home_field_code" testId="project-code" name="code" defaultValue={project?.code ?? ""} busy={pending} invalidBy={null} />
        <Field label="home_field_client" testId="project-client" name="client" defaultValue={project?.client ?? ""} busy={pending} invalidBy={null} />
        <Field label="home_field_site_address" testId="project-site-address" name="siteAddress" defaultValue={project?.siteAddress ?? ""} busy={pending} invalidBy={null} />
        <Field label="home_field_district" testId="project-district" name="district" defaultValue={project?.district ?? ""} busy={pending} invalidBy={null} />

        {/* I-33: no Select ships and a native one could not wear the reticle, so the five are
            interactive Chips in a fieldset — exactly one pressed — and a hidden input carries the
            chosen value into the native form. */}
        {/* A group takes `aria-invalid` where a fieldset takes no focus of its own: the judgement is
            about the choice, so it is stated on the thing that holds the five. */}
        <fieldset
          className="cx-home-types"
          data-testid="project-building-type"
          aria-invalid={invalidBy("project-building-type") === null ? undefined : true}
          aria-describedby={invalidBy("project-building-type") ?? undefined}
        >
          <legend className="cx-home-field-label">{strings.home_field_building_type}</legend>
          <div className="cx-home-types-choices">
            {/* The judgement is stated on each chip as well as on the group: a fieldset takes no
                focus of its own, so a person who arrives at a chip by keyboard — which is the only
                way they arrive at one — would otherwise meet a control that says nothing about
                being refused and points at no sentence explaining why (Q-11). */}
            {BUILDING_TYPES.map((type) => (
              <Chip
                key={type}
                selected={buildingType === type}
                aria-invalid={invalidBy("project-building-type") === null ? undefined : true}
                aria-describedby={invalidBy("project-building-type") ?? undefined}
                onClick={() => setBuildingType(type)}
              >
                {strings[BUILDING_TYPE_LABEL[type]]}
              </Chip>
            ))}
          </div>
          <input type="hidden" name="buildingType" value={buildingType} />
        </fieldset>

        <Field
          label="home_field_storeys"
          testId="project-storeys"
          name="storeys"
          defaultValue={String(project?.storeys ?? "")}
          busy={pending}
          inputMode="numeric"
          invalidBy={invalidBy("project-storeys")}
        />

        <div className="cx-home-field">
          <label className="cx-home-field-label" htmlFor={`${sftId}-gfa`}>
            {strings.home_field_gfa}
          </label>
          <p className="cx-home-field-hint" id={gfaHintId}>
            {strings.home_field_gfa_hint}
          </p>
          {/* The hint stands whatever the judgement said, so a judged field is described by both. */}
          <Input
            id={`${sftId}-gfa`}
            name="gfaM2"
            data-testid="project-gfa-m2"
            inputMode="decimal"
            value={gfaM2}
            aria-describedby={invalidBy("project-gfa-m2") === null ? gfaHintId : `${gfaHintId} ${alertId}`}
            aria-invalid={invalidBy("project-gfa-m2") === null ? undefined : true}
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

        {/* The answer and the doors are one bar, and the bar keeps the sheet's floor: an alert
            inserted into the slot grows a column that already scrolls, and with the doors merely
            last in it the sentence saying what is wrong and the door to press again would both be
            pushed past the fold — away from the field focus has just moved to. */}
        <div className="cx-home-form-close">
          {/* The answer slot, before the submit: exactly one of the judged sentence and a settled
              refusal stands in it, and in flight neither does. */}
          <div data-testid="project-form-refusal">
            {judgement !== null ? (
              <p className="cx-home-alert" role="alert" id={alertId}>
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
        </div>
      </form>
    </>
  );
}

/**
 * Which control a judged submission is about. Two fields share the "number" sentence, so the one the
 * person actually mis-stated is the one the m² value names: an area that would not be read as one is
 * that field's, and anything else leaves storeys as the only other number on the form.
 */
function offendingField(judgement: ProjectJudgement, gfaM2: string): string {
  if (judgement === "name") return "project-name";
  if (judgement === "buildingType") return "project-building-type";
  return gfaM2 !== "" && !isPlainDecimal(gfaM2) ? "project-gfa-m2" : "project-storeys";
}

/** One label-over-control field, in the idiom every form of this product uses (s-auth's § 1). */
function Field({
  label,
  testId,
  name,
  defaultValue,
  busy,
  inputMode,
  invalidBy,
}: {
  label: StringKey;
  testId: string;
  name: string;
  defaultValue: string;
  busy: boolean;
  inputMode?: "numeric" | "decimal";
  /** The id of the sentence judging this field, or null when the last submission was not about it. */
  invalidBy: string | null;
}) {
  const id = useId();
  return (
    <div className="cx-home-field">
      <label className="cx-home-field-label" htmlFor={id}>
        {strings[label]}
      </label>
      {/* In flight the field is read-only rather than disabled: disabling the focused element would
          remove it from the tab order and drop focus to the document body (the shell's ruling).
          A judged field wears the shipped invalid state and is described by the sentence judging
          it — the alert is announced once, and this is how it stays reachable from the control. */}
      <Input
        id={id}
        name={name}
        data-testid={testId}
        defaultValue={defaultValue}
        inputMode={inputMode}
        readOnly={busy}
        aria-busy={busy || undefined}
        aria-invalid={invalidBy === null ? undefined : true}
        aria-describedby={invalidBy ?? undefined}
      />
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
