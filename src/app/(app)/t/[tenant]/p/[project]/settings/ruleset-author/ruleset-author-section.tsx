"use client";
// S-Settings-Ruleset-Author: the screen a person authors a project's next rule-set edition on
// (R-SPINE-012, L-MEA-01, AM-04). What it shows is the pin being forked, a version the author
// states, and the WHOLE pin as a diff — every parameter, in the pin's own order, marked where the
// authored decimal differs from the pinned one (I-264). A diff that hid what did not move could not
// be checked for the thing an author actually fears: a value moved by accident.
//
// Typing mints nothing (I-263). The one door is `ruleset-author-submit`, which previews the act and
// opens the one ConsequenceDialog; the dialog's confirm commits with the digest it rendered
// (L-ACT-02). The section is a client module because the grid takes functions — column `cell`
// hooks, `getRowId`, `rowDataOf` — and a function cannot cross the server boundary; the page above
// does the reading and hands this the answer, so a suite mounts it over a staged view.
//
// `preview` and `commit` are props with the screen's own server actions as defaults, so a jsdom
// mount drives the same component the browser does without a server (the participants screen's
// pattern, B-17).
import "./ruleset-author.css";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { diffParameters, type ParameterDiffRow, type ProjectRulesetView } from "@/core/rulesets/editions";
import { Button, Input, NumberInput, QuantityText, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { ShellEmptyState, useShellPage } from "@/ui/shell";
import { TESTIDS } from "@/ui/testids";
import { SettingsAbout, SettingsHeader } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { rulesetRoute } from "../../home/areas";
import { rulesetParameterLabel } from "../ruleset/strings";
import { commitAuthorEdition, previewAuthorEdition, type CommitAnswer, type PreviewAnswer } from "./actions";
import { rulesetAuthorStatusDone, rulesetAuthorStrings, rulesetAuthorValueLabel } from "@/modules/spine/ruleset-authoring/strings";

/** The act this screen's one door carries out, verbatim as the seam and the dialog name it. */
const ACT_TYPE = "AUTHOR_RULESET_EDITION";

/** The grid's identity, which is what the reader's column furniture is remembered under (§5 rule 3). */
const DIFF_TABLE_ID = "ruleset-author-diff";

/** Where a refusal is resolved (Design Decision § 2) — the one evidence link this screen offers. */
interface Evidence {
  readonly href: string;
  readonly label: string;
}

export interface RulesetAuthorSectionProps {
  tenantId: string;
  projectId: string;
  view: ProjectRulesetView;
  /** The two doors, injectable so a jsdom mount drives this component without a server (B-17). */
  preview?: typeof previewAuthorEdition;
  commit?: typeof commitAuthorEdition;
}

/**
 * The grid's four columns (Design Decision § 1.1). The parameter is the frozen key column and
 * carries the parameter's WORDS — the key it is addressed by is the row's `data-param`, never body
 * text (s-settings-ruleset I-207). The pinned figure goes through `QuantityText`, so grouping is
 * the figure seam's and precision is the edition's; the authored figure is the shipped NumberInput.
 */
function diffColumns(onAuthor: (key: string, value: string) => void): ColumnDef<ParameterDiffRow, unknown>[] {
  return [
    {
      id: "parameter",
      header: rulesetAuthorStrings.ruleset_author_col_parameter,
      size: 360,
      cell: ({ row }) => <span className="cx-ruleset-author-param">{rulesetParameterLabel(row.original.key)}</span>,
    },
    {
      id: "pinned",
      header: rulesetAuthorStrings.ruleset_author_col_pinned,
      size: 180,
      meta: { align: "right" },
      cell: ({ row }) => <QuantityText className="cx-ruleset-author-pinned" value={row.original.before} data-testid={undefined} />,
    },
    {
      id: "authored",
      header: rulesetAuthorStrings.ruleset_author_col_authored,
      size: 220,
      cell: ({ row }) => (
        <NumberInput
          className="cx-ruleset-author-field"
          data-testid={TESTIDS.rulesetAuthor.value}
          aria-label={rulesetAuthorValueLabel(rulesetParameterLabel(row.original.key))}
          value={row.original.after}
          onChange={(value) => onAuthor(row.original.key, value)}
        />
      ),
    },
    {
      id: "unit",
      header: rulesetAuthorStrings.ruleset_author_col_unit,
      size: 96,
      cell: ({ row }) => <UnitBadge unit={row.original.unit} />,
    },
  ];
}

export function RulesetAuthorSection({ tenantId, projectId, view, preview = previewAuthorEdition, commit = commitAuthorEdition }: RulesetAuthorSectionProps) {
  // R-UI-084: the screen declares its own page crumb, through the frame's slot.
  useShellPage(rulesetAuthorStrings.ruleset_author_heading);

  const [version, setVersion] = useState("");
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [minted, setMinted] = useState<string | null>(null);
  const headingId = useId();

  const pinned = view.pinned ? view.parameters : null;
  /** The diff, recomputed from the pin and the decimals stated — the one home for "what changed". */
  const rows = useMemo(() => (pinned === null ? [] : diffParameters(pinned, values)), [pinned, values]);

  const onAuthor = useCallback((key: string, value: string) => {
    // A value authored back AT its pin is not a change and the row un-marks itself: the mark reads
    // the decimal, never whether the field was typed in (I-263). That follows from `diffParameters`
    // alone — nothing here remembers which field a reader touched.
    setValues((stated) => ({ ...stated, [key]: value }));
  }, []);

  const evidence: Evidence = { href: rulesetRoute(tenantId, projectId), label: rulesetAuthorStrings.ruleset_author_evidence_ruleset };
  /** A refusal in the shape the one act pattern rejects with and the one renderer composes (I-40). */
  const refused = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence }), [evidence.href, evidence.label]);

  /** What the author states, as both doors take it: the version and the decimal of every row. */
  const stated = useMemo(() => {
    const decimals: Record<string, string> = {};
    for (const row of rows) decimals[row.key] = row.after;
    return { projectId, version: version.trim(), values: decimals };
  }, [projectId, rows, version]);

  const dialogPreview = useCallback(async () => {
    const answered: PreviewAnswer = await preview(stated);
    if (!answered.previewed) throw refused(answered.refusal);
    return { consequence: answered.consequence, consequenceDigest: answered.consequenceDigest };
  }, [preview, refused, stated]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      const answered: CommitAnswer = await commit({ ...stated, consequenceDigest });
      if (!answered.committed) throw refused(answered.refusal);
      return { actId: answered.actId };
    },
    [commit, refused, stated],
  );

  /**
   * The door. It previews first, in this screen's own hands, so a refusal of the PREVIEW is
   * answered in place and no dialog opens over it (I-267) — only a computed Consequence is worth a
   * dialog. A second press while one is in flight does nothing: the button reads as busy and this
   * is what makes that true rather than decorative.
   */
  const open = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setRefusal(null);
    setMinted(null);
    try {
      const answered: PreviewAnswer = await preview(stated);
      if (!answered.previewed) setRefusal(answered.refusal);
      else setDialogOpen(true);
    } finally {
      setPending(false);
    }
  };

  if (!view.pinned) {
    return (
      <section className="cx-ruleset-author" data-testid={TESTIDS.rulesetAuthor.section} data-state="empty">
        <SettingsHeader title={rulesetAuthorStrings.ruleset_author_heading} about={[rulesetAuthorStrings.ruleset_author_caption, rulesetAuthorStrings.ruleset_author_version_hint]} />
        <div data-testid={TESTIDS.ruleset.unpinned}>
          <ShellEmptyState heading={rulesetAuthorStrings.ruleset_author_unpinned_heading} body={rulesetAuthorStrings.ruleset_author_unpinned_body}>
            <Link className="cx-shell-link cx-reticle" data-testid={TESTIDS.rulesetAuthor.seeRuleset} href={rulesetRoute(tenantId, projectId)}>
              {rulesetAuthorStrings.ruleset_author_see_ruleset}
            </Link>
          </ShellEmptyState>
        </div>
      </section>
    );
  }

  const state = refusal !== null ? "refused" : pending ? "busy" : "ready";
  return (
    <section className="cx-ruleset-author" data-testid={TESTIDS.rulesetAuthor.section} data-state={state}>
      <SettingsHeader title={rulesetAuthorStrings.ruleset_author_heading} about={[rulesetAuthorStrings.ruleset_author_caption, rulesetAuthorStrings.ruleset_author_version_hint]} />

      <div className="cx-ruleset-author-body">
        {/* The screen opens on what is being forked, not on a form (I-262): the pin's scope, its
            identity, and the digest its content keys — whole in the document, because that sameness
            is what a verbatim fork is recognised by (L-MEA-01, s-settings-ruleset I-206). */}
        <p className="cx-ruleset-author-identity">
          <span className="cx-ruleset-author-label">{rulesetAuthorStrings.ruleset_author_parent_label}</span>
          <span className="cx-ruleset-author-parent" data-testid={TESTIDS.rulesetAuthor.parent} data-scope={view.identity.scope} data-digest={view.digest}>
            <span className="cx-ruleset-author-scope">{view.identity.scope}</span>
            <span className="cx-ruleset-author-edition">{`${view.identity.name} @ ${view.identity.version}`}</span>
            <span className="cx-ruleset-author-digest" data-technical="">
              {view.digest}
            </span>
          </span>
          <label className="cx-ruleset-author-version-label" htmlFor={`${headingId}-version`}>
            {rulesetAuthorStrings.ruleset_author_version_label}
          </label>
          <Input
            className="cx-ruleset-author-version"
            id={`${headingId}-version`}
            data-testid={TESTIDS.rulesetAuthor.version}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
          <SettingsAbout body={rulesetAuthorStrings.ruleset_author_version_hint} label={rulesetAuthorStrings.ruleset_author_version_label} />
        </p>

        <div
          className="cx-ruleset-author-table cx-settings-surface"
          data-testid={TESTIDS.rulesetAuthor.diff}
          data-rendered-region={DIFF_TABLE_ID}
          data-rows-rendered={rows.length}
        >
          <DataTable
            tableId={DIFF_TABLE_ID}
            aria-label={rulesetAuthorStrings.ruleset_author_heading}
            columns={diffColumns(onAuthor)}
            data={[...rows]}
            getRowId={(row) => row.key}
            rowTestId={TESTIDS.rulesetAuthor.diffRow}
            rowDataOf={(row) => ({
              "data-param": row.key,
              "data-unit": row.unit,
              "data-before": row.before,
              "data-after": row.after,
              "data-changed": String(row.changed),
            })}
          />
        </div>

        {refusal === null ? null : (
          <div className="cx-ruleset-author-refusal" data-testid={TESTIDS.rulesetAuthor.refusal}>
            <RefusalState refusal={refusalOf(refusal)} evidence={evidence} />
          </div>
        )}

        <div className="cx-ruleset-author-act">
          {/* The answer is spoken in place and never as a toast (R-UI-020). The line keeps its
              height while it is empty, so nothing under it moves when the act answers. */}
          <p className="cx-ruleset-author-status" role="status" aria-live="polite">
            {minted !== null ? rulesetAuthorStatusDone(minted) : pending ? rulesetAuthorStrings.ruleset_author_status_pending : ""}
            {minted === null ? null : (
              <Link className="cx-shell-link cx-reticle" data-testid={TESTIDS.rulesetAuthor.seeRuleset} href={rulesetRoute(tenantId, projectId)}>
                {rulesetAuthorStrings.ruleset_author_see_ruleset}
              </Link>
            )}
          </p>
          <Button
            data-testid={TESTIDS.rulesetAuthor.submit}
            variant="primary"
            onClick={() => void open()}
            aria-busy={pending}
            disabled={version.trim() === ""}
          >
            {rulesetAuthorStrings.ruleset_author_submit}
          </Button>
        </div>
      </div>

      <ConsequenceDialog
        open={dialogOpen}
        actType={ACT_TYPE}
        preview={dialogPreview}
        commit={dialogCommit}
        onOpenChange={setDialogOpen}
        onCommitted={() => {
          // The minted edition is the visible answer: the two screens that show it are re-read by
          // the revalidation the commit made, and this line names the version the act carried.
          setMinted(stated.version);
          setRefusal(null);
        }}
      />
    </section>
  );
}
