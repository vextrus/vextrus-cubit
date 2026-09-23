"use client";
// The section renders the shipped DataTable, which is a client component, and hands it the column
// definitions and the row hooks it is specified with — `cell`, `getRowId`, `rowDataOf` are all
// functions. A function cannot cross the server/client boundary, so a server component holding this
// markup answers the whole settings screen with the fault card (R-UI-020's "something went wrong")
// instead of the pin. The screen reads nothing but the view it is handed, so it is a client module
// and the route above it stays the server component that does the reading.
//
// R-SPINE-012's settings surface on the v22 settings template (Design Direction 00 §3.6): the pinned
// edition as ONE line, then the parameter table every measurement on the project reads — the
// primary, first under the pin (R-UI-081, I-325) — 28 px rows, the parameter frozen, the figures mono
// and right-aligned; then the chain it was forked along as a 3-row 28 px table. The four helper
// sentences this screen used to print are behind the `(i)` on the headings they explain (§6: at most
// one helper line per screen, and this screen has none).
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
import { useMemo, useRef } from "react";
import { formatUserFigure } from "@/core/format";
import type { EditionLineageStep, EditionParameter, ProjectRulesetView } from "@/core/rulesets/editions";
import { EnumLabel, IdChip, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { ShellEmptyState, shellHref, useShellPage } from "@/ui/shell";
import { PROJECT_SETTINGS_PAGES } from "@/ui/shell/routes";
import { SettingsAbout, SettingsHeader } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { useRowsDrawn } from "./rows-drawn";
import { rulesetParameterLabel, rulesetScopeLabel, rulesetStrings } from "./strings";
import { TESTIDS } from "@/ui/testids";

/**
 * An edition's scope as a person reads it (R-UI-083, I-25 as amended by I-325): "Workspace", never
 * `tenant`. The stored value stays on `data-scope`, where every suite reads the chain's order, and in
 * EnumLabel's technical channel.
 */
function Scope({ scope }: { scope: string }) {
  return (
    <span className="cx-ruleset-scope" data-scope={scope}>
      <EnumLabel value={scope} label={rulesetScopeLabel(scope)} />
    </span>
  );
}

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

/** The chain of a view with no pin: nothing was forked, so there is no step to draw. */
const NO_LINEAGE: readonly EditionLineageStep[] = Object.freeze([]);

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
    cell: ({ row }) => <Scope scope={row.original.scope} />,
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
  // I-155: a digest is an identifier, and an identifier renders through the IdChip — the chip
  // measure on screen, the whole 64 characters in `data-value`, on the tooltip and on the clipboard.
  return <IdChip className="cx-ruleset-digest" data-testid={testId} value={value} />;
}

export function RulesetSettingsSection({ view }: { view: ProjectRulesetView }) {
  // The page crumb (R-UI-084): the same word the section nav's row and the header wear (B-17).
  useShellPage(PROJECT_SETTINGS_PAGES.ruleset);
  // I-349: each grid region publishes the RENDERED contract a retrying read waits on — the region's
  // own id on `data-rendered-region`, and on `data-rows-rendered` the count the table itself says it
  // drew, mirrored off the table's attribute rather than counted a second way (the Author edition
  // screen's § 7 pair). Asked before the no-pin branch: a hook is never behind a condition.
  const parameters = useMemo(() => (view.pinned ? parameterRows(view.parameters) : []), [view]);
  const lineage = view.pinned ? view.lineage : NO_LINEAGE;
  const parameterRegion = useRef<HTMLDivElement | null>(null);
  const lineageRegion = useRef<HTMLDivElement | null>(null);
  const parametersDrawn = useRowsDrawn(parameterRegion, parameters.length);
  const lineageDrawn = useRowsDrawn(lineageRegion, lineage.length);
  if (!view.pinned) {
    return (
      // The no-pin answer is this screen's EMPTY state (§2, I-28), and the root says so where a read
      // of the rendered contract takes it (I-209).
      <div className="cx-ruleset" data-screen-root="" data-state="empty">
        <SettingsHeader title={rulesetStrings.ruleset_heading} about={rulesetStrings.ruleset_caption} />
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
    // A pinned view is this screen's READY state (§2, I-209): the root states what it draws.
    <div className="cx-ruleset" data-screen-root="" data-state="ready">
      <SettingsHeader title={rulesetStrings.ruleset_heading} about={rulesetStrings.ruleset_caption} />

      {/* ONE line (§3.6), standing at the datum right under the title — §8's "the table starts at
          y ≈ 88" is what this section gives up its own heading for: the screen is named "Rule set"
          and the line under it is the pin. The identity and the digest are two fields on it and
          neither stands for the other (L-MEA-01). The (i) follows the digest it explains. */}
      <section className="cx-settings-section" aria-label={rulesetStrings.ruleset_edition_heading}>
        <p className="cx-ruleset-pin">
          <span className="cx-ruleset-identity" data-testid={TESTIDS.ruleset.editionIdentity}>
            <Scope scope={view.identity.scope} />
            <span className="cx-ruleset-edition">{editionLabel(view.identity)}</span>
          </span>
          <span className="cx-ruleset-digest-label">{rulesetStrings.ruleset_digest_label}</span>
          <Digest value={view.digest} testId={TESTIDS.ruleset.editionDigest} />
          <SettingsAbout body={rulesetStrings.ruleset_edition_hint} label={rulesetStrings.ruleset_edition_heading} />
        </p>
      </section>

      {/* I-325: the primary stands first under the pin — the values every measurement reads — and it
          is the region that takes the height the pane has left, scrolling inside its own frame. */}
      <section className="cx-settings-section cx-ruleset-primary" aria-labelledby={PARAMETERS_HEADING_ID}>
        <div className="cx-settings-section-head">
          <h2 className="cx-settings-section-heading" id={PARAMETERS_HEADING_ID}>
            {rulesetStrings.ruleset_parameters_heading}
          </h2>
        </div>
        <div
          ref={parameterRegion}
          className="cx-ruleset-table cx-ruleset-table-primary"
          data-testid={TESTIDS.ruleset.parameterTable}
          data-rendered-region={TESTIDS.ruleset.parameterTable}
          data-rows-rendered={parametersDrawn}
        >
          <DataTable
            tableId={PARAMETER_TABLE_ID}
            aria-labelledby={PARAMETERS_HEADING_ID}
            columns={PARAMETER_COLUMNS}
            data={parameters}
            getRowId={(row) => row.key}
            rowTestId={TESTIDS.ruleset.parameterRow}
            rowDataOf={(row) => ({ "data-param": row.key })}
          />
        </div>
      </section>

      <section className="cx-settings-section" aria-labelledby={LINEAGE_HEADING_ID}>
        <div className="cx-settings-section-head">
          <h2 className="cx-settings-section-heading" id={LINEAGE_HEADING_ID}>
            {rulesetStrings.ruleset_lineage_heading}
          </h2>
          <SettingsAbout body={rulesetStrings.ruleset_lineage_hint} label={rulesetStrings.ruleset_lineage_heading} />
        </div>
        <div
          ref={lineageRegion}
          className="cx-ruleset-table"
          data-testid={TESTIDS.ruleset.lineage}
          data-rendered-region={TESTIDS.ruleset.lineage}
          data-rows-rendered={lineageDrawn}
        >
          <DataTable
            tableId={LINEAGE_TABLE_ID}
            aria-labelledby={LINEAGE_HEADING_ID}
            columns={LINEAGE_COLUMNS}
            data={[...lineage]}
            getRowId={(step) => `${step.scope}-${step.name}-${step.version}`}
            rowTestId={TESTIDS.ruleset.lineageStep}
            rowDataOf={(step) => ({ "data-scope": step.scope })}
          />
        </div>
      </section>
    </div>
  );
}
