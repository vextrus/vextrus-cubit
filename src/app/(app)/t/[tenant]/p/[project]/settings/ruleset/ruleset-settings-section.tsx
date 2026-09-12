"use client";
// The section renders the shipped DataTable, which is a client component, and hands it the column
// definitions and the row hooks it is specified with — `cell`, `getRowId`, `rowDataOf` are all
// functions. A function cannot cross the server/client boundary, so a server component holding this
// markup answers the whole settings screen with the fault card (R-UI-020's "something went wrong")
// instead of the pin. The screen reads nothing but the view it is handed, so it is a client module
// and the route above it stays the server component that does the reading.
//
// R-SPINE-012's settings surface on the v22 settings template (Design Direction 00 §3.6): the pinned
// edition as ONE line, the chain it was forked along as a 3-row 28 px table, and the parameter table
// every measurement on the project reads — 28 px rows, the parameter frozen, the figures mono and
// right-aligned. The four helper sentences this screen used to print are behind the `(i)` on the
// headings they explain (§6: at most one helper line per screen, and this screen has none).
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
import { SettingsAbout, SettingsHeader } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { rulesetParameterLabel, rulesetStrings } from "./strings";
import { TESTIDS } from "@/ui/testids";

/**
 * The two grids, by the identity each reader's column furniture is remembered under (§5 rule 3).
 * The ids the rows published as raw `<tr>`s are kept byte-identical — `ruleset-parameter-table` on
 * the region, `ruleset-parameter-row` and `data-param` on each row, `ruleset-lineage` on the chain
 * and `ruleset-lineage-step` with `data-scope` on each of its rows — so every test and journey that
 * named one is untouched by the change of instrument.
 */
const PARAMETER_TABLE_ID = "ruleset-parameters";
const LINEAGE_TABLE_ID = "ruleset-lineage";

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
    size: 320,
    // §6: a person reads the parameter's name. The key it is addressed by is the row's own
    // `data-param`, which is where a suite, an export and an operator read it from — never body
    // text in a column of its own (C6).
    cell: ({ row }) => <span className="cx-ruleset-param">{rulesetParameterLabel(row.original.key)}</span>,
  },
  {
    id: "value",
    header: rulesetStrings.ruleset_col_value,
    size: 160,
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

/** The chain as the grid takes a row: the step itself, keyed by the scope it was forked at. */
const LINEAGE_COLUMNS: ColumnDef<EditionLineageStep, unknown>[] = [
  {
    id: "scope",
    header: rulesetStrings.ruleset_lineage_col_scope,
    size: 120,
    cell: ({ row }) => <span className="cx-ruleset-scope">{row.original.scope}</span>,
  },
  {
    id: "edition",
    header: rulesetStrings.ruleset_lineage_col_edition,
    size: 280,
    cell: ({ row }) => <span className="cx-ruleset-edition">{editionLabel(row.original)}</span>,
  },
  {
    id: "digest",
    header: rulesetStrings.ruleset_digest_label,
    size: 160,
    // Whole in the DOM and short on the screen: while the chain is a verbatim fork every step reads
    // the same, and that sameness is what this section exists to show (L-MEA-01, I-26).
    cell: ({ row }) => <Digest value={row.original.digest} />,
  },
];

/** The headings the sections and the tables are named by, so each region says what it is. */
const LINEAGE_HEADING_ID = "ruleset-lineage-heading";
const PARAMETERS_HEADING_ID = "ruleset-parameters-heading";

/** An edition as L-MEA-01 spells one: `IS1200_IN @ 2026.08`. */
function editionLabel(step: { name: string; version: string }): string {
  return `${step.name}${rulesetStrings.ruleset_identity_joiner}${step.version}`;
}

/**
 * A content digest, as a person meets one: the chip measure on screen, the whole 64 characters in
 * the document, selectable as one thing (I-26). The element is the technical channel §6 names —
 * which is what makes a fingerprint lawful on a screen at all — and it is what L-MEA-01 asks the
 * surface to show, so it is never abbreviated in the DATA it publishes.
 */
function Digest({ value, testId }: { value: string; testId?: string }) {
  return (
    <span className="cx-ruleset-digest" data-testid={testId} data-technical="">
      {value}
    </span>
  );
}

export function RulesetSettingsSection({ view }: { view: ProjectRulesetView }) {
  if (!view.pinned) {
    return (
      <div className="cx-ruleset">
        <SettingsHeader title={rulesetStrings.ruleset_heading} about={rulesetStrings.ruleset_caption} />
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
      <SettingsHeader title={rulesetStrings.ruleset_heading} about={rulesetStrings.ruleset_caption} />

      {/* ONE line (§3.6), standing at the datum right under the title — §8's "the table starts at
          y ≈ 88" is what this section gives up its own heading for: the screen is named "Rule set"
          and the line under it is the pin. The identity and the digest are two fields on it and
          neither stands for the other (L-MEA-01). */}
      <section className="cx-settings-section" aria-label={rulesetStrings.ruleset_edition_heading}>
        <p className="cx-ruleset-pin">
          <span className="cx-ruleset-identity" data-testid="ruleset-edition-identity">
            <span className="cx-ruleset-scope" data-scope={view.identity.scope}>
              {view.identity.scope}
            </span>
            <span className="cx-ruleset-edition">{editionLabel(view.identity)}</span>
          </span>
          <span className="cx-ruleset-digest-label">{rulesetStrings.ruleset_digest_label}</span>
          <Digest value={view.digest} testId="ruleset-edition-digest" />
          <SettingsAbout body={rulesetStrings.ruleset_edition_hint} label={rulesetStrings.ruleset_edition_heading} />
        </p>
      </section>

      <section className="cx-settings-section" aria-labelledby={LINEAGE_HEADING_ID}>
        <div className="cx-settings-section-head">
          <h2 className="cx-settings-section-heading" id={LINEAGE_HEADING_ID}>
            {rulesetStrings.ruleset_lineage_heading}
          </h2>
          <SettingsAbout body={rulesetStrings.ruleset_lineage_hint} label={rulesetStrings.ruleset_lineage_heading} />
        </div>
        <div className="cx-ruleset-table" data-testid="ruleset-lineage">
          <DataTable
            tableId={LINEAGE_TABLE_ID}
            aria-labelledby={LINEAGE_HEADING_ID}
            columns={LINEAGE_COLUMNS}
            data={[...view.lineage]}
            getRowId={(step) => `${step.scope}-${step.name}-${step.version}`}
            rowTestId="ruleset-lineage-step"
            rowDataOf={(step) => ({ "data-scope": step.scope })}
          />
        </div>
      </section>

      <section className="cx-settings-section cx-settings-surface" aria-labelledby={PARAMETERS_HEADING_ID}>
        <div className="cx-settings-section-head">
          <h2 className="cx-settings-section-heading" id={PARAMETERS_HEADING_ID}>
            {rulesetStrings.ruleset_parameters_heading}
          </h2>
        </div>
        <div className="cx-ruleset-table cx-settings-surface" data-testid="ruleset-parameter-table">
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
