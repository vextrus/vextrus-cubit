"use client";
// S-Settings-Ruleset-Author (R-SPINE-012, L-MEA-01, AM-04): what the project reads today, the
// version an author states, and the whole pin as a diff — then the one ConsequenceDialog.
//
// The section holds the screen's whole behaviour and takes `preview` and `commit` as props, exactly
// as the participants screen does: given them, a suite renders the very component a browser renders,
// and the route above it stays the server component that does the reading (the SignInForm
// precedent, ARCH-01 — a module may not reach the app tier for its actions).
//
// I-263: typing changes nothing. Editing a field re-computes its row's `data-after` and
// `data-changed` and does no more; the door is the only door, and it previews before it commits.
import "./ruleset-author.css";

import { useCallback, useId, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { refusalOf, type RefusalCode } from "@/core/errors";
import type { CommitAnswer, PreviewAnswer } from "./actions";
// The words a parameter is named by are the settings area's one table (I-268) — a plain function,
// read here rather than handed across the server/client boundary, which no function may cross.
import { parameterLabel } from "../strings";
import type { EditionIdentity, EditionParameter } from "@/core/rulesets/editions";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { BasisChip, Button, Input, NumberInput, QuantityText, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { ShellEmptyState, useShellPage } from "@/ui/shell";
import { fill } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { authoredValues, diffParameters, rulesetAuthorStrings, type ParameterDiffRow } from "@/modules/spine/ruleset-authoring";

/** The act this screen renders (L-ACT-02's pair), spelled once. */
const ACT_TYPE = "AUTHOR_RULESET_EDITION";

/** The identity each reader's column furniture is remembered under (§5 rule 3). */
const DIFF_TABLE_ID = "ruleset-author-diff";

/** R-UI-002's glyph for a figure a person entered, which is what an authored value is. */
const ENTERED = "ENTERED";

/** What an author states: the version, and the decimals under the pin's own parameter keys. */
export interface AuthorRequest {
  projectId: string;
  version: string;
  values: Readonly<Record<string, string>>;
}

/** The edition this screen forks: what a surface needs of it, and no more (I-262). */
export interface AuthorParentEdition {
  readonly identity: EditionIdentity;
  readonly digest: string;
  readonly parameters: Readonly<Record<string, EditionParameter>>;
}

export interface RulesetAuthorSectionProps {
  projectId: string;
  /** The edition the project reads today, or null where the address names no pinned project. */
  parent: AuthorParentEdition | null;
  /** Where the rule-set screen stands — the way onward after a commit, and out of the empty state. */
  rulesetHref: string;
  /** Where the permission is granted, for the refusal that names it (R-UI-020's evidence link). */
  participantsHref: string;
  /** Whether this reader holds AUTHOR_RULE_SET. False renders the whole screen and a shut door (I-266). */
  mayAuthor: boolean;
  preview: (request: AuthorRequest) => Promise<PreviewAnswer>;
  commit: (request: AuthorRequest & { consequenceDigest: string }) => Promise<CommitAnswer>;
}

/** An edition as L-MEA-01 spells one: `IS1200_IN @ 2026.08`. */
function identityLine(identity: EditionIdentity): string {
  return `${identity.name} @ ${identity.version}`;
}

export function RulesetAuthorSection({
  projectId,
  parent,
  rulesetHref,
  participantsHref,
  mayAuthor,
  preview,
  commit,
}: RulesetAuthorSectionProps) {
  // R-UI-084: the screen declares its own crumb, through the frame's slot (`useShellPage`).
  useShellPage(rulesetAuthorStrings.ruleset_author_heading);

  const [version, setVersion] = useState("");
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<RefusalCode | null>(mayAuthor ? null : "PERMISSION_NOT_HELD");
  const [dialogOpen, setDialogOpen] = useState(false);
  /** The version the act carried, once it has been carried: what the status line speaks (§ 2). */
  const [minted, setMinted] = useState<string | null>(null);
  const refusalId = useId();
  const headingId = useId();

  const rows = useMemo(() => (parent === null ? [] : diffParameters(parent.parameters, values)), [parent, values]);

  /** Where each reachable refusal is resolved (§ 2) — a place, named in the button voice. */
  const evidenceFor = useCallback(
    (code: RefusalCode) => {
      if (code === "PERMISSION_NOT_HELD") return { href: participantsHref, label: rulesetAuthorStrings.ruleset_author_heading };
      if (code === "EDITION_VERSION_TAKEN") return { href: rulesetHref, label: rulesetAuthorStrings.ruleset_author_see_ruleset };
      return { href: rulesetHref, label: rulesetAuthorStrings.ruleset_author_see_ruleset };
    },
    [participantsHref, rulesetHref],
  );

  /** A refusal, in the shape the one act pattern rejects with and the one renderer composes. */
  const refused = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  const stated = useCallback((): AuthorRequest => ({ projectId, version, values: authoredValues(rows) }), [projectId, rows, version]);

  const dialogPreview = useCallback(async () => {
    const answered = await preview(stated());
    if (!answered.previewed) throw refused(answered.refusal);
    return { consequence: answered.consequence, consequenceDigest: answered.consequenceDigest };
  }, [preview, refused, stated]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      const answered = await commit({ ...stated(), consequenceDigest });
      if (!answered.committed) throw refused(answered.refusal);
      return { actId: answered.actId };
    },
    [commit, refused, stated],
  );

  /**
   * The door. I-267: a refusal of the preview is answered in place and NO dialog opens; only a
   * consequence opens one. Nothing the reader typed is cleared by a refusal — a refusal that
   * emptied the form would make them do the work twice.
   */
  const submit = async (): Promise<void> => {
    if (pending || !mayAuthor) return;
    setPending(true);
    setMinted(null);
    setRefusal(null);
    const answered = await preview(stated());
    setPending(false);
    if (!answered.previewed) {
      setRefusal(answered.refusal);
      return;
    }
    setDialogOpen(true);
  };

  const columns = useMemo<ColumnDef<ParameterDiffRow, unknown>[]>(
    () => [
      {
        id: "parameter",
        header: rulesetAuthorStrings.ruleset_author_col_parameter,
        size: 360,
        // §6: a person reads the parameter's name; the key it is addressed by is the row's own
        // `data-param` (s-settings-ruleset I-207), never a column of body text.
        cell: ({ row }) => <span className="cx-ruleset-author-param">{parameterLabel(row.original.key)}</span>,
      },
      {
        id: "pinned",
        header: rulesetAuthorStrings.ruleset_author_col_pinned,
        size: 180,
        meta: { align: "right" },
        // Grouping is the figure seam's and precision is the edition's: the pinned decimal goes
        // through the one formatter and this screen rounds nothing (L-FMT-02).
        cell: ({ row }) => <QuantityText className="cx-ruleset-author-pinned" value={row.original.before} />,
      },
      {
        id: "authored",
        header: rulesetAuthorStrings.ruleset_author_col_authored,
        size: 220,
        cell: ({ row }) => (
          <span className="cx-ruleset-author-field">
            <NumberInput
              className="cx-ruleset-author-input"
              data-testid={TESTIDS.rulesetAuthor.value}
              aria-label={fill(rulesetAuthorStrings.ruleset_author_value_label, { parameter: parameterLabel(row.original.key) })}
              value={row.original.after}
              onChange={(next) => setValues((held) => ({ ...held, [row.original.key]: next }))}
            />
            <span className="cx-ruleset-author-suffix">{row.original.unit}</span>
            {/* Direction §5 rule 7's edited-cell glyph: the mark survives greyscale (R-UI-002). */}
            {row.original.changed ? <BasisChip basis={ENTERED} /> : null}
          </span>
        ),
      },
      {
        id: "unit",
        header: rulesetAuthorStrings.ruleset_author_col_unit,
        size: 96,
        cell: ({ row }) => <UnitBadge unit={row.original.unit} />,
      },
    ],
    [],
  );

  if (parent === null) {
    return (
      <div className="cx-ruleset-author" data-state="empty">
        <section className="cx-ruleset-author-section" data-testid={TESTIDS.rulesetAuthor.section} aria-labelledby={headingId}>
          <h1 className="cx-ruleset-author-heading" id={headingId}>
            {rulesetAuthorStrings.ruleset_author_heading}
          </h1>
          <div data-testid={TESTIDS.ruleset.unpinned}>
            <ShellEmptyState heading={rulesetAuthorStrings.ruleset_author_unpinned_heading} body={rulesetAuthorStrings.ruleset_author_unpinned_body}>
              <a className="cx-shell-link cx-reticle" data-testid={TESTIDS.rulesetAuthor.seeRuleset} href={rulesetHref}>
                {rulesetAuthorStrings.ruleset_author_see_ruleset}
              </a>
            </ShellEmptyState>
          </div>
        </section>
      </div>
    );
  }

  const state = pending ? "busy" : refusal !== null ? "refused" : "ready";

  return (
    <div className="cx-ruleset-author" data-state={state}>
      <section className="cx-ruleset-author-section" data-testid={TESTIDS.rulesetAuthor.section} aria-labelledby={headingId}>
        <h1 className="cx-ruleset-author-heading" id={headingId}>
          {rulesetAuthorStrings.ruleset_author_heading}
        </h1>

        {/* I-262: the screen opens on what is being forked — one line, the pin itself, with the
            parent's content digest whole in the document beside its identity (L-MEA-01). */}
        <p className="cx-ruleset-author-identity">
          <span className="cx-ruleset-author-label">{rulesetAuthorStrings.ruleset_author_parent_label}</span>
          <span
            className="cx-ruleset-author-parent"
            data-testid={TESTIDS.rulesetAuthor.parent}
            data-digest={parent.digest}
            data-technical=""
          >
            <span className="cx-ruleset-author-scope" data-scope={parent.identity.scope}>
              {parent.identity.scope}
            </span>
            <span className="cx-ruleset-author-edition">{identityLine(parent.identity)}</span>
            <span className="cx-ruleset-author-digest">{parent.digest}</span>
          </span>
          <span className="cx-ruleset-author-version-field">
            <span className="cx-ruleset-author-label">{rulesetAuthorStrings.ruleset_author_version_label}</span>
            <Input
              className="cx-ruleset-author-version"
              data-testid={TESTIDS.rulesetAuthor.version}
              aria-label={rulesetAuthorStrings.ruleset_author_version_label}
              inputMode="text"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </span>
        </p>

        {/* I-264: the diff is the whole pin, always — changed rows are marked, never filtered. */}
        <div className="cx-ruleset-author-table" data-testid={TESTIDS.rulesetAuthor.diff} data-rendered-region="ruleset-author-diff">
          <DataTable
            tableId={DIFF_TABLE_ID}
            aria-label={rulesetAuthorStrings.ruleset_author_heading}
            columns={columns}
            data={[...rows]}
            getRowId={(row) => row.key}
            rowTestId={TESTIDS.rulesetAuthor.diffRow}
            rowDataOf={(row) => ({
              "data-param": row.key,
              "data-unit": row.unit,
              "data-before": row.before,
              "data-after": row.after,
              "data-changed": row.changed ? "true" : "false",
            })}
          />
        </div>

        {/* The one answer slot: a refusal renders in place with its code, message, remedy and the
            evidence that resolves it — never a toast, never a block of this screen's own (R-UI-020). */}
        <div className="cx-ruleset-author-refusal" data-testid={TESTIDS.rulesetAuthor.refusal} id={refusalId}>
          {refusal !== null && !pending ? <RefusalState refusal={refusalOf(refusal)} evidence={evidenceFor(refusal)} /> : null}
        </div>

        <div className="cx-ruleset-author-act">
          {/* The two things a round trip has beyond its answer, spoken rather than only drawn: the
              act is irreversible, and a reader who cannot see the grid re-read hears it (R-UI-050). */}
          <p className="cx-ruleset-author-status" role="status" aria-live="polite">
            {pending
              ? rulesetAuthorStrings.ruleset_author_status_pending
              : minted === null
                ? ""
                : fill(rulesetAuthorStrings.ruleset_author_status_done, { version: minted })}
            {minted === null ? null : (
              <a className="cx-shell-link cx-reticle" data-testid={TESTIDS.rulesetAuthor.seeRuleset} href={rulesetHref}>
                {rulesetAuthorStrings.ruleset_author_see_ruleset}
              </a>
            )}
          </p>
          {/* I-266: the door stands for a reader who cannot walk through it, and the standing
              PERMISSION_NOT_HELD beside it says why — nothing is hidden (R-SPINE-006). */}
          <Button
            className="cx-ruleset-author-submit"
            data-testid={TESTIDS.rulesetAuthor.submit}
            loading={pending}
            aria-disabled={mayAuthor ? undefined : true}
            aria-describedby={mayAuthor ? undefined : refusalId}
            onClick={() => void submit()}
          >
            {rulesetAuthorStrings.ruleset_author_submit}
          </Button>
        </div>
      </section>

      <ConsequenceDialog
        open={dialogOpen}
        actType={ACT_TYPE}
        preview={dialogPreview}
        commit={dialogCommit}
        onOpenChange={setDialogOpen}
        onCommitted={() => {
          // The minted edition IS the answer: the route revalidates and the grid re-renders against
          // the new pin, so the stated values go back to the pin's own and the version field empties
          // — a screen that kept them would invite the same edition twice (§ 2, Ready).
          setMinted(version);
          setVersion("");
          setValues({});
        }}
      />
    </div>
  );
}
