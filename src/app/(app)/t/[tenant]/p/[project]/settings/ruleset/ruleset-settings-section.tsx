// R-SPINE-012's settings surface: the edition a project is pinned to, its content digest, the chain
// it was forked along, and the parameter table every measurement on the project reads.
//
// L-MEA-01 keeps identity and digest apart, and this screen shows both — the identity names WHICH
// rule set is in force, the digest fingerprints exactly what it holds, and neither substitutes for
// the other. A view that reports no pin gets the honest absence notice (R-UI-020, I-28), never an
// empty edition panel.
//
// The sheet travels with the thing it dresses (B-17): loaded from the route instead, the rules ship
// for every request of that route whether the section renders or not, and the section cannot be
// mounted anywhere else without losing its appearance.
import "./ruleset.css";

import Link from "next/link";
import { formatUserFigure } from "../../../../../../../../core/format";
import type { EditionLineageStep, ProjectRulesetView } from "../../../../../../../../core/rulesets/editions";
import { UnitBadge } from "../../../../../../../../ui/primitives/core";
import { ShellEmptyState, shellHref } from "../../../../../../../../ui/shell";
import { rulesetParameterLabel, rulesetStrings } from "./strings";

/** The headings the sections and the table are named by, so each region says what it is. */
const EDITION_HEADING_ID = "ruleset-edition-heading";
const LINEAGE_HEADING_ID = "ruleset-lineage-heading";
const PARAMETERS_HEADING_ID = "ruleset-parameters-heading";

/** An edition as L-MEA-01 spells one: `IS1200_IN @ 2026.08`. */
function editionLabel(step: { name: string; version: string }): string {
  return `${step.name}${rulesetStrings.ruleset_identity_joiner}${step.version}`;
}

/** The heading and the sentence that says what this screen holds; the same above either answer. */
function RulesetHeader() {
  return (
    <div className="cx-ruleset-header">
      <h1 className="cx-shell-heading">{rulesetStrings.ruleset_heading}</h1>
      <p className="cx-ruleset-caption">{rulesetStrings.ruleset_caption}</p>
    </div>
  );
}

/** One step of the fork chain: its own (scope, name, version), and the digest that step carries. */
function LineageStep({ step }: { step: EditionLineageStep }) {
  return (
    <li className="cx-ruleset-lineage-step" data-testid="ruleset-lineage-step" data-scope={step.scope}>
      <div className="cx-ruleset-lineage-identity">
        <span className="cx-ruleset-lineage-scope">{step.scope}</span>
        <span className="cx-ruleset-lineage-edition">{editionLabel(step)}</span>
      </div>
      {/* Whole, like every digest here: while the chain is a verbatim fork every step reads the
          same, and that sameness is what this section exists to show (L-MEA-01, I-26). */}
      <div className="cx-ruleset-lineage-digest">{step.digest}</div>
    </li>
  );
}

export function RulesetSettingsSection({ view }: { view: ProjectRulesetView }) {
  if (!view.pinned) {
    return (
      <div className="cx-ruleset">
        <RulesetHeader />
        <div data-testid="ruleset-unpinned">
          <ShellEmptyState heading={rulesetStrings.ruleset_unpinned_heading} body={rulesetStrings.ruleset_unpinned_body}>
            {/* A move inside the frame, so it travels through the router like every other one. */}
            <Link className="cx-shell-link cx-reticle" href={shellHref(view.tenantId, "projects")}>
              {rulesetStrings.ruleset_unpinned_action}
            </Link>
          </ShellEmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="cx-ruleset">
      <RulesetHeader />

      <section className="cx-ruleset-section" aria-labelledby={EDITION_HEADING_ID}>
        <h2 className="cx-ruleset-section-heading" id={EDITION_HEADING_ID}>
          {rulesetStrings.ruleset_edition_heading}
        </h2>
        <p className="cx-ruleset-hint">{rulesetStrings.ruleset_edition_hint}</p>
        <dl className="cx-ruleset-facts">
          <div className="cx-ruleset-fact">
            <dt className="cx-ruleset-fact-label">{rulesetStrings.ruleset_identity_label}</dt>
            <dd className="cx-ruleset-identity" data-testid="ruleset-edition-identity">
              <span className="cx-ruleset-scope" data-scope={view.identity.scope}>
                {view.identity.scope}
              </span>
              <span className="cx-ruleset-edition">{editionLabel(view.identity)}</span>
            </dd>
          </div>
          <div className="cx-ruleset-fact">
            <dt className="cx-ruleset-fact-label">{rulesetStrings.ruleset_digest_label}</dt>
            <dd className="cx-ruleset-digest" data-testid="ruleset-edition-digest">
              {view.digest}
            </dd>
          </div>
        </dl>
      </section>

      <section className="cx-ruleset-section" aria-labelledby={LINEAGE_HEADING_ID}>
        <h2 className="cx-ruleset-section-heading" id={LINEAGE_HEADING_ID}>
          {rulesetStrings.ruleset_lineage_heading}
        </h2>
        <p className="cx-ruleset-hint">{rulesetStrings.ruleset_lineage_hint}</p>
        <ol className="cx-ruleset-lineage" data-testid="ruleset-lineage">
          {view.lineage.map((step) => (
            <LineageStep key={`${step.scope}-${step.name}-${step.version}`} step={step} />
          ))}
        </ol>
      </section>

      <section className="cx-ruleset-section" aria-labelledby={PARAMETERS_HEADING_ID}>
        <h2 className="cx-ruleset-section-heading" id={PARAMETERS_HEADING_ID}>
          {rulesetStrings.ruleset_parameters_heading}
        </h2>
        <table className="cx-ruleset-table" data-testid="ruleset-parameter-table" aria-labelledby={PARAMETERS_HEADING_ID}>
          <thead>
            <tr>
              <th className="cx-ruleset-col" scope="col">
                {rulesetStrings.ruleset_col_parameter}
              </th>
              <th className="cx-ruleset-col" scope="col">
                {rulesetStrings.ruleset_col_key}
              </th>
              <th className="cx-ruleset-col cx-ruleset-col-value" scope="col">
                {rulesetStrings.ruleset_col_value}
              </th>
              <th className="cx-ruleset-col" scope="col">
                {rulesetStrings.ruleset_col_unit}
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(view.parameters).map(([key, parameter]) => (
              <tr className="cx-ruleset-row" data-testid="ruleset-parameter-row" data-param={key} key={key}>
                <th className="cx-ruleset-param" scope="row">
                  {rulesetParameterLabel(key)}
                </th>
                <td className="cx-ruleset-key">{key}</td>
                {/* Grouping is the seam's and precision is the edition's: the figure goes through
                    the one formatter and this screen rounds nothing (I-27, L-FMT-02). */}
                <td className="cx-ruleset-value">{formatUserFigure(parameter.value)}</td>
                <td className="cx-ruleset-unit">
                  <UnitBadge unit={parameter.unit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
