// R-SPINE-060: this screen's copy, and all of it — the section carries no string literal of its own
// beyond test ids and fixed attribute values. The keys read `ruleset_…`, under the same discipline
// as the tables in `src/ui/strings/*` (Design Decision I-24).
//
// "Workspace" rather than "tenant" everywhere a person reads (s-auth I-11). A scope is an enum and
// renders through EnumLabel under the words below; the stored value (`tenant`) travels in the
// primitive's technical channel and on `data-scope`, never as body text (R-UI-083, I-25 as amended).
export const rulesetStrings = {
  ruleset_heading: "Rule set",
  ruleset_caption: "Pinned when the project was created. Every measurement on this project reads exactly these values.",

  ruleset_edition_heading: "Pinned edition",
  ruleset_edition_hint: "The identity names this edition; the digest fingerprints its exact content. Two editions with one digest hold identical values.",
  ruleset_identity_label: "Identity",
  ruleset_digest_label: "Content digest",

  // The words each edition scope is read by (R-UI-083): `tenant` is "Workspace", the product's own
  // word for it everywhere else (s-auth I-11).
  ruleset_scope_platform: "Platform",
  ruleset_scope_tenant: "Workspace",
  ruleset_scope_project: "Project",

  ruleset_lineage_heading: "Lineage",
  // The chain's own columns: a step names the scope it was forked at, the edition it is, and the
  // digest that step carries (§3.6's three-column lineage).
  ruleset_lineage_col_scope: "Scope",
  ruleset_lineage_col_edition: "Edition",
  ruleset_lineage_hint: "The chain this pin was forked along, platform first. A verbatim fork carries its parent's digest unchanged.",

  ruleset_parameters_heading: "Parameters",
  ruleset_col_parameter: "Parameter",
  ruleset_col_value: "Value",
  ruleset_col_unit: "Unit",

  ruleset_unpinned_heading: "No rule set to show",
  ruleset_unpinned_body:
    "This address does not name a project in this workspace. A project pins its rule set when it is created, so a project that exists always has one.",
  ruleset_unpinned_action: "Go to Projects",

  // L-MEA-01's own spelling of an edition: `IS1200_IN @ 2026.08`. The joiner is copy, so it is here
  // rather than inside the markup that puts a name beside a version.
  ruleset_identity_joiner: " @ ",
} as const;

/**
 * The human label for each parameter of the seed edition. A key with no label here renders as
 * itself: the screen never hides a parameter it has no wording for (Design Decision §3).
 */
export const rulesetParameterLabels: Readonly<Record<string, string>> = {
  ruleset_param_openingDeductionMinM2: "Opening deduction minimum",
  ruleset_param_memberEndNoDeductMaxCm2: "Member end no-deduct maximum",
  ruleset_param_embeddedDuctNoDeductMaxCm2: "Embedded duct no-deduct maximum",
  ruleset_param_finishOpeningDeductionMinM2: "Finish opening deduction minimum",
  ruleset_param_finishMinOutlineArea: "Finish outline minimum area",
  ruleset_param_finishMaxOutlineArea: "Finish outline maximum area",
  ruleset_param_scaleVerificationTolerance: "Scale verification tolerance",
  ruleset_param_scaleAnisotropyTolerance: "Scale anisotropy tolerance",
  ruleset_param_earthworkWorkingAllowance: "Earthwork working allowance",
  ruleset_param_earthworkDepthExtra: "Earthwork extra depth",
  ruleset_param_blindingProjection: "Blinding projection",
  ruleset_param_blindingThickness: "Blinding thickness",
  ruleset_param_placementContainmentMerge: "Placement containment merge share",
  ruleset_param_placementNearAnchor: "Placement near-anchor share",
  ruleset_param_placementFootprintMin: "Placement footprint minimum share",
  ruleset_param_placementFootprintMax: "Placement footprint maximum share",
  ruleset_param_placementHumanSnap: "Placement human snap share",
};

/** The label a parameter is shown under, or the key itself when the table has no wording for it. */
export function rulesetParameterLabel(key: string): string {
  return rulesetParameterLabels[`ruleset_param_${key}`] ?? key;
}

/** The words each scope is read by. A scope with no words here reads as itself: nothing is hidden. */
const SCOPE_LABELS: Readonly<Record<string, string>> = {
  platform: rulesetStrings.ruleset_scope_platform,
  tenant: rulesetStrings.ruleset_scope_tenant,
  project: rulesetStrings.ruleset_scope_project,
};

/** The label an edition's scope is shown under, through EnumLabel beside the stored value (R-UI-083). */
export function rulesetScopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}
