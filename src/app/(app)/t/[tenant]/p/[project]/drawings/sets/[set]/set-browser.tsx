"use client";
// S-Drawings-Sets (R-TO-005, L-REG-06): the set browser — every drawing the project holds with the
// revisions it stands at, the draft toggle that says which of them this set names, the pin, and the
// revisions this set has already been pinned at.
//
// `toggle`, `preview` and `commit` replace the server actions and nothing else: given them, the
// screen maps the settlement exactly as it maps the real ones (the SheetIndex precedent).
//
// I-103's precedent: the screen pre-checks the preview and the dialog opens only on a consequence. A
// refusal before the dialog opens is this screen's answer, in the pin region's own slot; a refusal
// that arrives once the dialog holds focus is the dialog's.
import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { refusalOf, type RefusalCode } from "../../../../../../../../../core/errors";
import { formatUserFigure } from "../../../../../../../../../core/format";
import { ConsequenceDialog } from "../../../../../../../../../ui/patterns/consequence-dialog";
import { RefusalState } from "../../../../../../../../../ui/patterns/refusal-state";
import { Button } from "../../../../../../../../../ui/primitives/core";
import { ShellEmptyState } from "../../../../../../../../../ui/shell";
import { fill, strings } from "../../../../../../../../../ui/strings";
import type { DrawingLineage, DrawingSetView, SetRevision } from "../../../../../../../../../modules/takeoff/sets";
import { participantsRoute } from "../../../settings/participants/route-address";
import { drawingsRoute } from "../../route-address";
import { commitPin as commitPinAction, previewPin as previewPinAction, toggleMember as toggleMemberAction } from "../actions";
import { setRoute, setsRoute } from "../route-address";
import { sets } from "../strings";

/** The act this screen renders (L-ACT-02's pair opens the one dialog under this name). */
const ACT_TYPE = "PIN_DRAWING_SET";

/** Which emptiness the pin region is reporting, in the Decision's own precedence (I-97). */
type EmptyCause = "no-drawings" | "no-revisions" | "no-members";

export interface SetBrowserProps {
  tenantId: string;
  projectId: string;
  set: DrawingSetView;
  lineages: readonly DrawingLineage[];
  /** Whether this reader holds PIN_SET on the project (I-101). */
  canPin: boolean;
  toggle?: typeof toggleMemberAction;
  preview?: typeof previewPinAction;
  commit?: typeof commitPinAction;
}

/** Where a refusal this screen can meet is resolved: a place, named in the button voice. */
interface Evidence {
  readonly href: string;
  readonly label: string;
}

export function SetBrowser({
  tenantId,
  projectId,
  set,
  lineages,
  canPin,
  toggle = toggleMemberAction,
  preview = previewPinAction,
  commit = commitPinAction,
}: SetBrowserProps) {
  // The draft as this screen stands: a toggle writes at once and the row moves with it (I-96).
  const [members, setMembers] = useState<readonly string[]>(set.members);
  const [memberRefusal, setMemberRefusal] = useState<RefusalCode | null>(null);
  const [pinRefusal, setPinRefusal] = useState<RefusalCode | null>(null);
  const [pending, setPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const headingIds = { members: useId(), pin: useId(), revisions: useId() };

  const evidenceFor = useCallback(
    (code: RefusalCode): Evidence => {
      if (code === "PERMISSION_NOT_HELD" || code === "WORKSPACE_PERMISSION_NOT_HELD") return { href: participantsRoute(tenantId, projectId), label: sets.sets_evidence_participants };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      if (code === "SET_NAME_NOT_USABLE") return { href: setsRoute(tenantId, projectId), label: sets.sets_evidence_reload };
      return { href: setRoute(tenantId, projectId, set.setId), label: sets.sets_evidence_set };
    },
    [tenantId, projectId, set.setId],
  );

  /** A refusal, in the shape the one act pattern rejects with and the one renderer composes. */
  const refused = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  const onToggle = async (drawingId: string): Promise<void> => {
    setMemberRefusal(null);
    const answered = await toggle({ tenantId, projectId, setId: set.setId, drawingId });
    if (!answered.toggled) {
      setMemberRefusal(answered.refusal);
      return;
    }
    setMembers((held) => (answered.member ? [...held.filter((id) => id !== drawingId), drawingId] : held.filter((id) => id !== drawingId)));
  };

  const dialogPreview = useCallback(async () => {
    const answered = await preview({ tenantId, projectId, setId: set.setId });
    if (!answered.previewed) throw refused(answered.refusal);
    return { consequence: answered.consequence, consequenceDigest: answered.consequenceDigest };
  }, [preview, projectId, refused, set.setId, tenantId]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      const answered = await commit({ tenantId, projectId, setId: set.setId, consequenceDigest });
      if (!answered.committed) throw refused(answered.refusal);
      return { actId: answered.actId };
    },
    [commit, projectId, refused, set.setId, tenantId],
  );

  /** I-103: the pre-check, then the dialog on a consequence and never on nothing. */
  const press = async (): Promise<void> => {
    if (pending) return;
    setPinRefusal(null);
    setPending(true);
    // The door is released whatever the pre-check answers: a refusal is this screen's answer, and a
    // fault belongs to the boundary — neither leaves the door standing in its loading state (B-21).
    const answered = await preview({ tenantId, projectId, setId: set.setId }).finally(() => setPending(false));
    if (!answered.previewed) {
      setPinRefusal(answered.refusal);
      return;
    }
    setDialogOpen(true);
  };

  const cause = emptinessOf(lineages, members, set.revisions);
  // I-97: exactly one of these stands at a time.
  const emptiness = cause === null ? null : <Empty cause={cause} tenantId={tenantId} projectId={projectId} />;

  return (
    <div className="cx-set" data-testid="set-browser" data-set={set.setId}>
      <header className="cx-sets-header">
        <h1 className="cx-sets-heading" data-testid="set-heading">
          {set.name}
        </h1>
        <p className="cx-sets-caption">{sets.sets_set_caption}</p>
        <p className="cx-set-links">
          <Link className="cx-sets-link cx-reticle" data-testid="set-drawings-link" href={drawingsRoute(tenantId, projectId)}>
            {sets.sets_drawings_link}
          </Link>
          <Link className="cx-sets-link cx-reticle" href={setsRoute(tenantId, projectId)}>
            {sets.sets_sets_link}
          </Link>
        </p>
      </header>

      {/* I-101: the browser stands whole for a reader without PIN_SET, and one banner names the
          permission and who holds it. */}
      {canPin ? null : (
        <div className="cx-sets-denied">
          <p className="cx-sets-denied-line">{sets.sets_denied_permission}</p>
          <p className="cx-sets-denied-line">{sets.sets_denied_holder}</p>
          <RefusalState refusal={refusalOf("PERMISSION_NOT_HELD")} evidence={evidenceFor("PERMISSION_NOT_HELD")} />
        </div>
      )}

      <section className="cx-sets-section" aria-labelledby={headingIds.members}>
        <h2 className="cx-sets-section-heading" id={headingIds.members}>
          {sets.sets_members_heading}
        </h2>
        <p className="cx-sets-hint">{sets.sets_members_hint}</p>
        <ul className="cx-sets-list" data-testid="set-drawings">
          {lineages.map((lineage) => (
            <DrawingRow
              canPin={canPin}
              key={lineage.drawingId}
              lineage={lineage}
              member={members.includes(lineage.drawingId)}
              onToggle={() => {
                void onToggle(lineage.drawingId);
              }}
            />
          ))}
        </ul>
        {/* R-UI-020: an empty list says why it is empty where it stands. The one `set-empty` element
            is the pin region's (I-97), so what this list owes is a sentence and not a second one. */}
        {lineages.length === 0 ? <p className="cx-sets-silence">{sets.sets_members_none}</p> : null}
        <div className="cx-sets-answer cx-shell-live">
          {memberRefusal === null ? null : <RefusalState refusal={refusalOf(memberRefusal)} evidence={evidenceFor(memberRefusal)} />}
        </div>
      </section>

      {canPin ? (
        <section className="cx-sets-section" aria-labelledby={headingIds.pin}>
          <h2 className="cx-sets-section-heading" id={headingIds.pin}>
            {sets.sets_pin_heading}
          </h2>
          <p className="cx-sets-hint">{sets.sets_pin_hint}</p>
          <Button
            className="cx-set-pin"
            data-testid="set-pin"
            loading={pending}
            onClick={() => {
              void press();
            }}
            variant="secondary"
          >
            {sets.sets_pin_submit}
          </Button>
          <p className="cx-sets-status cx-shell-live" role="status" aria-live="polite">
            {pending ? sets.sets_pin_pending : null}
          </p>
          <div className="cx-sets-answer cx-shell-live">
            {pinRefusal === null || pending ? null : <RefusalState refusal={refusalOf(pinRefusal)} evidence={evidenceFor(pinRefusal)} />}
          </div>
        </section>
      ) : null}

      {/* I-97: one `set-empty` on the screen, and it stands in the column rather than inside the pin
          section — the empty state carries a heading of its own, and a heading about the drawings a
          set can name is not owned by "Pin this set" (R-UI-050's outline). It stands whether or not
          this reader may pin: a denial takes the section away, never the answer to why there is
          nothing here. */}
      {emptiness}

      <section className="cx-sets-section" aria-labelledby={headingIds.revisions}>
        <h2 className="cx-sets-section-heading" id={headingIds.revisions}>
          {sets.sets_revisions_heading}
        </h2>
        <p className="cx-sets-hint">{sets.sets_revisions_hint}</p>
        {set.revisions.length === 0 ? (
          <p className="cx-sets-silence">{sets.sets_revisions_none}</p>
        ) : (
          <ol className="cx-sets-revisions" data-testid="set-revisions">
            {set.revisions.map((revision) => (
              <PinnedRevision key={revision.setRevisionId} revision={revision} />
            ))}
          </ol>
        )}
      </section>

      <ConsequenceDialog
        actType={ACT_TYPE}
        commit={dialogCommit}
        onCommitted={() => {
          // The pinned revision is the visible answer, and it is server-read from the ledger the act
          // just appended to — so the screen re-reads rather than inventing the row it would show.
          // Nothing is said in the pin region's live region here: the re-read replaces the document,
          // so a sentence written into it is gone before it can be announced (§ 1).
          reread();
        }}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        preview={dialogPreview}
      />
    </div>
  );
}

/**
 * I-97: three causes, one element, judged in the Decision's own order — a project holding no
 * drawings can name none, then a set never pinned, then a set that names nothing now (so pinning as
 * it stands would refuse).
 */
function emptinessOf(lineages: readonly DrawingLineage[], members: readonly string[], revisions: readonly SetRevision[]): EmptyCause | null {
  if (lineages.length === 0) return "no-drawings";
  if (revisions.length === 0) return "no-revisions";
  if (members.length === 0) return "no-members";
  return null;
}

/** What each emptiness teaches, and the one place it points at (Decision § 1, § 3). */
function Empty({ cause, tenantId, projectId }: { cause: EmptyCause; tenantId: string; projectId: string }) {
  const words = {
    "no-drawings": { heading: sets.sets_empty_no_drawings_heading, body: sets.sets_empty_no_drawings_body },
    "no-revisions": { heading: sets.sets_empty_no_revisions_heading, body: sets.sets_empty_no_revisions_body },
    "no-members": { heading: sets.sets_empty_no_members_heading, body: sets.sets_empty_no_members_body },
  }[cause];

  return (
    <div data-testid="set-empty" data-cause={cause}>
      <ShellEmptyState heading={words.heading} body={words.body}>
        {cause === "no-drawings" ? (
          <Link className="cx-sets-link cx-reticle" href={drawingsRoute(tenantId, projectId)}>
            {sets.sets_drawings_link}
          </Link>
        ) : (
          <Link className="cx-sets-link cx-reticle" href={setsRoute(tenantId, projectId)}>
            {sets.sets_sets_link}
          </Link>
        )}
      </ShellEmptyState>
    </div>
  );
}

/**
 * One drawing of the project: its lineage, whether this set names it, and the door that moves it in
 * or out. Every revision renders as its ordinal and its content address whole (I-95) — a machine
 * identifier is data, and which one is current is said in words, never by colour alone.
 */
function DrawingRow({ lineage, member, canPin, onToggle }: { lineage: DrawingLineage; member: boolean; canPin: boolean; onToggle: () => void }) {
  return (
    <li className="cx-sets-row" data-testid="set-drawing" data-drawing={lineage.drawingId} data-member={member ? "true" : "false"} data-current-sha256={lineage.current.sha256}>
      <div className="cx-sets-row-facts">
        <p className="cx-sets-row-name" data-testid="set-drawing-name">
          {lineage.name}
        </p>
        <p className="cx-sets-row-counts" data-testid="set-drawing-revision-count">
          {fill(sets.sets_revision_count, { count: formatUserFigure(String(lineage.revisions.length)) })}
        </p>
        <ol className="cx-sets-revision-list">
          {lineage.revisions.map((revision) => {
            const current = revision.revisionId === lineage.current.revisionId;
            return (
              <li
                className="cx-sets-revision"
                data-current={current ? "true" : "false"}
                data-ordinal={String(revision.ordinal)}
                data-revision={revision.revisionId}
                data-sha256={revision.sha256}
                data-testid="set-drawing-revision"
                key={revision.revisionId}
              >
                <span className="cx-sets-ordinal">{formatUserFigure(String(revision.ordinal))}</span>
                <span className="cx-sets-digest">{revision.sha256}</span>
                <span className="cx-sets-standing">{current ? sets.sets_revision_current : sets.sets_revision_superseded}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {canPin ? (
        <Button
          aria-label={fill(member ? sets.sets_member_remove_label : sets.sets_member_add_label, { drawing: lineage.name })}
          aria-pressed={member}
          data-drawing={lineage.drawingId}
          data-testid="set-member-toggle"
          onClick={onToggle}
          variant={member ? "secondary" : "ghost"}
        >
          {member ? sets.sets_member_remove : sets.sets_member_add}
        </Button>
      ) : null}
    </li>
  );
}

/**
 * One pinned revision, shown exactly as it was pinned (I-98): the manifest is the citation list, so
 * every member it held renders — including a drawing the set no longer names and a revision since
 * superseded — and nothing is recomputed against today's membership.
 */
function PinnedRevision({ revision }: { revision: SetRevision }) {
  return (
    <li className="cx-set-revision" data-testid="set-revision" data-set-revision={revision.setRevisionId} data-digest={revision.digest} data-current={revision.current ? "true" : "false"}>
      <p className="cx-set-revision-head">
        <span className="cx-sets-standing">{revision.current ? sets.sets_revision_current : sets.sets_revision_superseded}</span>
        <span className="cx-sets-row-digest-label">{sets.sets_revision_digest_label}</span>
        <span className="cx-sets-digest" data-testid="set-revision-digest">
          {revision.digest}
        </span>
      </p>
      <ul className="cx-set-citations">
        {revision.manifest.map((member) => (
          <li className="cx-set-citation" data-testid="set-revision-member" data-drawing={member.drawingId} data-revision={member.revisionId} data-sha256={member.sha256} key={member.revisionId}>
            <span className="cx-set-citation-name">{member.name}</span>
            <span className="cx-sets-digest">{member.sha256}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Read the screen again from the server. Both surfaces this screen shows after an act — the pinned
 * revisions and the sets index behind them — are server-rendered from the ledger, so the answer is
 * the re-read and never a row assembled in the browser (R-UI-021).
 */
function reread(): void {
  if (typeof window === "undefined") return;
  window.location.reload();
}
