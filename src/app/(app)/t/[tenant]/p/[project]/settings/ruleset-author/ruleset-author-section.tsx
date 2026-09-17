"use client";
// S-Settings-Ruleset-Author (R-SPINE-012, L-MEA-01, AM-04): the edition a project reads, the version
// an author states, and the whole pin as a diff. `preview` and `commit` replace the server actions
// and nothing else — given them, the screen maps the settlement exactly as it maps the real ones,
// which is what makes the screen a browser renders and the section a suite mounts one component (the
// ParticipantsSection precedent).
//
// I-263: typing changes nothing and mints nothing. A field re-computes its row's `data-after` and
// `data-changed`, and that is all; the ONE door previews the act and the one ConsequenceDialog
// carries it with the digest it rendered (L-ACT-02).
import "./ruleset-author.css";

import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { refusalOf, type RefusalCode } from "@/core/errors";
import type { ProjectRulesetView } from "@/core/rulesets/editions";
import { diffParameters, type ParameterDiffRow } from "@/modules/spine/ruleset-authoring";
import { rulesetAuthorStrings } from "./strings";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { BasisChip, Button, EnumLabel, Input, NumberInput, QuantityText, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { ShellEmptyState, shellHref, useShellPage } from "@/ui/shell";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { SettingsHeader } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { rulesetParameterLabel } from "../ruleset/strings";
import { rulesetRoute } from "../../home/areas";
import { commitAuthorEdition, previewAuthorEdition, type CommitAnswer, type PreviewAnswer } from "./actions";

/** The act this screen renders, and the one dialog it opens for (L-ACT-02). */
const ACT_TYPE = "AUTHOR_RULESET_EDITION";

/** The grid's identity, which is what each reader's column furniture is remembered under (§5 rule 3). */
const DIFF_TABLE_ID = "ruleset-author-diff";

/** Where a refusal is resolved: a place, named in the button voice (refusal-state § 3). */
interface Evidence {
  readonly href: string;
  readonly label: string;
}

export interface RulesetAuthorSectionProps {
  tenantId: string;
  projectId: string;
  view: ProjectRulesetView;
  preview?: typeof previewAuthorEdition;
  commit?: typeof commitAuthorEdition;
}

/**
 * The columns, ruled in § 1.1: the frozen key column, the two figures, then the mark. They are built
 * over the one door back to the screen's state, because the authored column is a FIELD on every row
 * at once rather than a cell a reader opens (I-263) — the grid's own inline-edit machinery is not
 * used, so the callback reaches the cells the way every other prop does.
 */
function diffColumns(stated: (key: string, value: string) => void): ColumnDef<ParameterDiffRow, unknown>[] {
  return [
    {
      id: "parameter",
      header: rulesetAuthorStrings.ruleset_author_col_parameter,
      size: 360,
      // A person reads the parameter's NAME. The key it is addressed by is the row's own `data-param`,
      // which is where a suite, an export and an operator read it from — never body text (I-265).
      cell: ({ row }) => <span className="cx-ruleset-author-param">{rulesetParameterLabel(row.original.key)}</span>,
    },
    {
      id: "pinned",
      header: rulesetAuthorStrings.ruleset_author_col_pinned,
      size: 180,
      meta: { align: "right" },
      // Grouping is the figure seam's and precision is the edition's: the pinned decimal goes through
      // the one formatter and this screen rounds nothing (L-FMT-02).
      cell: ({ row }) => <QuantityText className="cx-ruleset-author-pinned" value={row.original.before} />,
    },
    {
      id: "authored",
      header: rulesetAuthorStrings.ruleset_author_col_authored,
      size: 220,
      cell: ({ row }) => <AuthoredCell row={row.original} stated={stated} />,
    },
    {
      id: "change",
      header: rulesetAuthorStrings.ruleset_author_col_change,
      size: 120,
      // The mark is a WORD as well as an attribute and a glyph: nothing on this screen means anything
      // by colour alone (§ 6).
      cell: ({ row }) => (
        <EnumLabel
          className="cx-ruleset-author-mark"
          value={row.original.changed ? rulesetAuthorStrings.ruleset_author_changed : rulesetAuthorStrings.ruleset_author_unchanged}
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

/** One row's authored field: the pin's unit as its suffix, the exact decimal in `data-after`. */
function AuthoredCell({ row, stated }: { row: ParameterDiffRow; stated: (key: string, value: string) => void }) {
  return (
    <span className="cx-ruleset-author-authored" data-changed={String(row.changed)}>
      <NumberInput
        className="cx-ruleset-author-field"
        data-testid={TESTIDS.rulesetAuthor.value}
        aria-label={fill(rulesetAuthorStrings.ruleset_author_value_label, {
          parameter: rulesetParameterLabel(row.key),
        })}
        value={row.after}
        onChange={(value) => stated(row.key, value)}
      />
      <span className="cx-ruleset-author-suffix">{row.unit}</span>
      {/* Direction §5 rule 7's edited-cell glyph, so the mark survives greyscale (R-UI-002). */}
      {row.changed ? <BasisChip basis="ENTERED" /> : null}
    </span>
  );
}

export function RulesetAuthorSection({ tenantId, projectId, view, preview = previewAuthorEdition, commit = commitAuthorEdition }: RulesetAuthorSectionProps) {
  // R-UI-084: the screen declares its own crumb, through the frame's slot (`useShellPage`).
  useShellPage(rulesetAuthorStrings.ruleset_author_heading);
  const [version, setVersion] = useState("");
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // What the act minted, once it has been carried. An append-only act that cannot be undone is not
  // confirmed by a grid quietly re-rendering: the screen says so, in a live region (R-UI-050).
  const [minted, setMinted] = useState<string | null>(null);
  const headingId = useId();

  const ruleset = rulesetRoute(tenantId, projectId);

  /**
   * Where each reachable refusal is resolved (§ 2). `EDITION_VERSION_TAKEN` sends a reader to the
   * rule-set screen, which lists the versions this project already holds; a code with no case of its
   * own is resolved by stating something else on this very screen — silence never happens (R-UI-020).
   */
  const evidenceFor = useCallback(
    (code: RefusalCode): Evidence => {
      if (code === "PERMISSION_NOT_HELD")
        return {
          href: shellHref(tenantId, "projects"),
          label: strings.home_evidence_projects,
        };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return {
        href: ruleset,
        label: rulesetAuthorStrings.ruleset_author_evidence_ruleset,
      };
    },
    [ruleset, tenantId],
  );

  /** A refusal, in the shape the one act pattern rejects with and the one renderer composes (I-40). */
  const refused = useCallback(
    (code: RefusalCode): unknown => ({
      refusal: refusalOf(code),
      evidence: evidenceFor(code),
    }),
    [evidenceFor],
  );

  const pin = view.pinned ? view.parameters : null;
  // The whole pin, always, in the pin's own order — a diff that hides what did not move cannot be
  // checked for the thing a reader actually fears: a value moved by accident (I-264).
  const rows = useMemo(() => (pin === null ? [] : diffParameters(pin, values)), [pin, values]);
  const stated = useCallback((key: string, value: string) => setValues((held) => ({ ...held, [key]: value })), []);
  const columns = useMemo(() => diffColumns(stated), [stated]);

  const dialogPreview = useCallback(async () => {
    const answered: PreviewAnswer = await preview({
      projectId,
      version,
      values,
    });
    if (!answered.previewed) throw refused(answered.refusal);
    return {
      consequence: answered.consequence,
      consequenceDigest: answered.consequenceDigest,
    };
  }, [preview, projectId, refused, values, version]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      const answered: CommitAnswer = await commit({
        projectId,
        version,
        values,
        consequenceDigest,
      });
      if (!answered.committed) throw refused(answered.refusal);
      return { actId: answered.actId };
    },
    [commit, projectId, refused, values, version],
  );

  const submit = async (): Promise<void> => {
    // A preview is a round trip, and the door stays where it is while it is in flight: a second
    // press would compute a second consequence for the same statement and open the dialog on
    // whichever answered last (R-UI-050).
    if (pending) return;
    setRefusal(null);
    setMinted(null);
    setPending(true);
    const answered = await preview({ projectId, version, values });
    setPending(false);
    // I-267: a refused preview is answered in place, and only a consequence opens a dialog.
    if (!answered.previewed) {
      setRefusal(answered.refusal);
      return;
    }
    setDialogOpen(true);
  };

  if (!view.pinned) {
    return (
      <div className="cx-ruleset-author">
        <section data-testid={TESTIDS.rulesetAuthor.section} data-state="empty">
          <SettingsHeader title={rulesetAuthorStrings.ruleset_author_heading} about={rulesetAuthorStrings.ruleset_author_caption} />
          <div data-testid={TESTIDS.ruleset.unpinned}>
            <ShellEmptyState heading={rulesetAuthorStrings.ruleset_author_unpinned_heading} body={rulesetAuthorStrings.ruleset_author_unpinned_body}>
              {/* A move inside the frame, so it travels through the router like every other one. */}
              <Link className="cx-shell-link cx-reticle" data-testid={TESTIDS.rulesetAuthor.seeRuleset} href={ruleset}>
                {rulesetAuthorStrings.ruleset_author_see_ruleset}
              </Link>
            </ShellEmptyState>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cx-ruleset-author">
      <section
        className="cx-ruleset-author-body"
        data-testid={TESTIDS.rulesetAuthor.section}
        data-state={pending ? "busy" : refusal !== null ? "refused" : "ready"}
      >
        <SettingsHeader
          title={rulesetAuthorStrings.ruleset_author_heading}
          about={[rulesetAuthorStrings.ruleset_author_caption, rulesetAuthorStrings.ruleset_author_version_hint]}
        />

        {/* The screen opens on what is being FORKED, not on a form (I-262): the pin as one line, its
          identity and its digest beside each other, neither standing for the other (L-MEA-01). */}
        <section className="cx-settings-section cx-ruleset-author-identity" aria-label={rulesetAuthorStrings.ruleset_author_parent_label}>
          <p className="cx-ruleset-author-parent" data-testid={TESTIDS.rulesetAuthor.parent} data-digest={view.digest}>
            <span className="cx-ruleset-author-label">{rulesetAuthorStrings.ruleset_author_parent_label}</span>
            <span className="cx-ruleset-author-scope" data-scope={view.identity.scope}>
              {view.identity.scope}
            </span>
            <span className="cx-ruleset-author-edition">
              {view.identity.name}
              {rulesetAuthorStrings.ruleset_author_identity_joiner}
              {view.identity.version}
            </span>
            <span className="cx-ruleset-author-label">{rulesetAuthorStrings.ruleset_author_digest_label}</span>
            {/* Whole in the document, drawn at the chip measure: the digest is what L-MEA-01 asks the
              surface to show, so it is never abbreviated in the DATA it publishes (I-206). */}
            <span className="cx-ruleset-author-digest" data-technical="">
              {view.digest}
            </span>
          </p>
          <label className="cx-ruleset-author-version-field">
            <span className="cx-ruleset-author-label">{rulesetAuthorStrings.ruleset_author_version_label}</span>
            <Input
              className="cx-ruleset-author-version"
              data-testid={TESTIDS.rulesetAuthor.version}
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </label>
        </section>

        <section className="cx-settings-section cx-settings-surface" aria-labelledby={headingId}>
          <h2 className="cx-settings-section-heading cx-ruleset-author-heading" id={headingId}>
            {rulesetAuthorStrings.ruleset_author_col_parameter}
          </h2>
          <div
            className="cx-ruleset-author-table cx-settings-surface"
            data-testid={TESTIDS.rulesetAuthor.diff}
            data-rendered-region={DIFF_TABLE_ID}
            data-rows-rendered={rows.length}
          >
            <DataTable
              tableId={DIFF_TABLE_ID}
              aria-labelledby={headingId}
              columns={columns}
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
        </section>

        {/* The answer slot: exactly one RefusalState, with the code, the remedy and the evidence link
          the code is resolved at — never a toast, never a screen-local block (R-UI-020). */}
        <div data-testid={TESTIDS.rulesetAuthor.refusal}>
          {refusal !== null && !pending ? <RefusalState refusal={refusalOf(refusal)} evidence={evidenceFor(refusal)} /> : null}
        </div>

        <div className="cx-ruleset-author-act">
          {/* The two states a round trip has beyond its answer: in flight, and written. Both are
            announced rather than only drawn — the act is irreversible (R-UI-050, R-UI-012). */}
          <p className="cx-ruleset-author-status" role="status" aria-live="polite">
            {pending
              ? rulesetAuthorStrings.ruleset_author_status_pending
              : minted === null
                ? ""
                : fill(rulesetAuthorStrings.ruleset_author_status_done, {
                    version: minted,
                  })}
          </p>
          {minted === null ? null : (
            <Link className="cx-shell-link cx-reticle" data-testid={TESTIDS.rulesetAuthor.seeRuleset} href={ruleset}>
              {rulesetAuthorStrings.ruleset_author_see_ruleset}
            </Link>
          )}
          <Button
            className="cx-ruleset-author-submit"
            data-testid={TESTIDS.rulesetAuthor.submit}
            loading={pending}
            disabled={version.trim() === ""}
            onClick={() => void submit()}
          >
            {rulesetAuthorStrings.ruleset_author_submit}
          </Button>
        </div>

        <ConsequenceDialog
          open={dialogOpen}
          actType={ACT_TYPE}
          preview={dialogPreview}
          commit={dialogCommit}
          onOpenChange={setDialogOpen}
          onCommitted={() => {
            // The minted edition is the visible answer: the route revalidates, so the parent line and
            // the grid re-render against the NEW pin, and the stated values go back to being the pin's
            // — what a reader sees next is what the project now reads (§ 2, Ready).
            setValues({});
            setMinted(version);
          }}
        />
      </section>
    </div>
  );
}
