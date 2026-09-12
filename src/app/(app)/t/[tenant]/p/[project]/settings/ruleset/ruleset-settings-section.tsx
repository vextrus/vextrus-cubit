"use client";
// The section renders the shipped DataTable, which is a client component, and hands it the column
// definitions and the row hooks it is specified with — `cell`, `getRowId`, `rowDataOf` are all
// functions. A function cannot cross the server/client boundary, so a server component holding this
// markup answers the whole settings screen with the fault card (R-UI-020's "something went wrong")
// instead of the pin. The screen reads nothing but the view it is handed, so it is a client module
// and the route above it stays the server component that does the reading.
// R-SPINE-012's settings surface: the edition a project is pinned to, its content digest, the chain
// it was forked along, and the parameter table every measurement on the project reads.
//
// L-MEA-01 keeps identity and digest apart, and this screen shows both — the identity names WHICH
// rule set is in force, the digest fingerprints exactly what it holds, and neither substitutes for
// the other. A view that reports no pin gets the honest absence notice (R-UI-020, I-28), never an
// empty edition panel.
// The section is exported for any screen to compose, so it declares the stylesheet its own markup
// needs: a rule set panel loaded by a second consumer arrives with the same classes and none of the
// rules if the route that happens to render it today is what carries them.
import "./ruleset.css";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { formatUserFigure } from "@/core/format";
import type { EditionLineageStep, EditionParameter, ProjectRulesetView } from "@/core/rulesets/editions";
import { UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { ShellEmptyState, shellHref } from "@/ui/shell";
import { rulesetParameterLabel, rulesetStrings } from "./strings";
import { TESTIDS } from "@/ui/testids";

/**
 * The parameter table is the shipped DataTable (Design Direction 00 §5): 28 px rows from the root's
 * `--row-h`, the parameter frozen as the key column, mono tabular figures right-aligned and the
 * unit as its own narrow column. The ids its rows published as raw `<tr>`s are kept byte-identical
 * — `ruleset-parameter-table` on the region, `ruleset-parameter-row` and `data-param` on each row —
 * so every test and journey that named one is untouched by the change of instrument.
 */
const PARAMETER_TABLE_ID = "ruleset-parameters";

/** One parameter as the grid takes a row: the key it is addressed by, and what the edition holds. */
interface ParameterRow extends EditionParameter {
  readonly key: string;
}

const parameterRows = (parameters: Readonly<Record<string, EditionParameter>>): ParameterRow[] =>
  Object.entries(parameters).map(([key, parameter]) => ({ key, ...parameter }));

const PARAMETER_COLUMNS: ColumnDef<ParameterRow, unknown>[] = [
  {
    id: "parameter",
    header: rulesetStrings.ruleset_col_parameter,
    size: 220,
    cell: ({ row }) => <span className="cx-ruleset-param">{rulesetParameterLabel(row.original.key)}</span>,
  },
  {
    id: "key",
    header: rulesetStrings.ruleset_col_key,
    size: 240,
    cell: ({ row }) => <span className="cx-ruleset-key">{row.original.key}</span>,
  },
  {
    id: "value",
    header: rulesetStrings.ruleset_col_value,
    size: 140,
    meta: { align: "right" },
    // Grouping is the seam's and precision is the edition's: the figure goes through the one
    // formatter and this screen rounds nothing (I-27, L-FMT-02).
    cell: ({ row }) => <span className="cx-ruleset-value">{formatUserFigure(row.original.value)}</span>,
  },
  {
    id: "unit",
    header: rulesetStrings.ruleset_col_unit,
    size: 96,
    cell: ({ row }) => <UnitBadge unit={row.original.unit} />,
  },
];

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
    <li className="cx-ruleset-lineage-step" data-testid={TESTIDS.ruleset.lineageStep} data-scope={step.scope}>
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
        <div data-testid={TESTIDS.ruleset.unpinned}>
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
            <dd className="cx-ruleset-identity" data-testid={TESTIDS.ruleset.editionIdentity}>
              <span className="cx-ruleset-scope" data-scope={view.identity.scope}>
                {view.identity.scope}
              </span>
              <span className="cx-ruleset-edition">{editionLabel(view.identity)}</span>
            </dd>
          </div>
          <div className="cx-ruleset-fact">
            <dt className="cx-ruleset-fact-label">{rulesetStrings.ruleset_digest_label}</dt>
            <dd className="cx-ruleset-digest" data-testid={TESTIDS.ruleset.editionDigest}>
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
        <ol className="cx-ruleset-lineage" data-testid={TESTIDS.ruleset.lineage}>
          {view.lineage.map((step) => (
            <LineageStep key={`${step.scope}-${step.name}-${step.version}`} step={step} />
          ))}
        </ol>
      </section>

      <section className="cx-ruleset-section" aria-labelledby={PARAMETERS_HEADING_ID}>
        <h2 className="cx-ruleset-section-heading" id={PARAMETERS_HEADING_ID}>
          {rulesetStrings.ruleset_parameters_heading}
        </h2>
        <div className="cx-ruleset-table" data-testid={TESTIDS.ruleset.parameterTable}>
          <DataTable
            tableId={PARAMETER_TABLE_ID}
            aria-labelledby={PARAMETERS_HEADING_ID}
            columns={PARAMETER_COLUMNS}
            data={parameterRows(view.parameters)}
            getRowId={(row) => row.key}
            rowTestId="ruleset-parameter-row"
            rowDataOf={(row) => ({ "data-param": row.key })}
          />
        </div>
      </section>
    </div>
  );
}
