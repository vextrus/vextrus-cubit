"use client";
// S-Drawings (R-TO-004): the project's sheet index — the Dropzone that fills it, the timeline that
// reports what is being read, the cards themselves, and L-ACT-02's offer over them.
//
// `preview`, `commit`, `requestSheets` and `requestThumbnails` replace the server actions and nothing
// else: given them, the screen maps the settlement exactly as it maps the real ones, which is what
// makes the screen a browser renders and the section a test renders one component (the SignInForm
// precedent).
//
// I-49's precedent: the screen pre-checks the preview and the dialog opens only on a consequence. A
// refusal before the dialog opens is this screen's answer, in the pressed door's own slot; a refusal
// that arrives once the dialog holds focus is the dialog's.
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DISCIPLINES } from "../../../../../../../core/sheets/law";
import { refusalOf, type RefusalCode } from "../../../../../../../core/errors";
import { formatUserFigure } from "../../../../../../../core/format";
import { ConsequenceDialog } from "../../../../../../../ui/patterns/consequence-dialog";
import { Dropzone, uploadFiles, type DropzoneFile, type DropzoneItem } from "../../../../../../../ui/patterns/dropzone";
import { OfferedGroups, type OfferedGroupItem } from "../../../../../../../ui/patterns/offered-group";
import { RefusalState } from "../../../../../../../ui/patterns/refusal-state";
import { Button, Chip, Input } from "../../../../../../../ui/primitives/core";
import { fill, strings } from "../../../../../../../ui/strings";
import { participantsRoute } from "../settings/participants/route-address";
import {
  commitConfirmDiscipline,
  previewConfirmDiscipline,
  requestSheetsFor,
  requestThumbnailsFor,
  type CommitAnswer,
  type PreviewAnswer,
} from "./actions";
import { JobTimeline, type TimelineJob } from "./job-timeline";
import { drawingsRoute } from "./route-address";
import { SheetCard, type SheetCardData } from "./sheet-card";
import { drawings } from "./strings";

/** The act this screen renders (L-ACT-02's pair opens the one dialog under this name). */
const ACT_TYPE = "CONFIRM_DISCIPLINE";

/** The filter's own extra option: every discipline at once, and the default (Decision § 1). */
const ALL = "ALL";

/**
 * Whether an asked-for job is one the timeline reports (I-88). A job id is a step to follow, and a
 * deduplicated answer is a step already finished — the seam saying the work stands. An answer with
 * neither enqueued nothing and settled nothing: the request was refused, and a refusal is read where
 * the queue row already carries it (R-UI-020), never as a step that claims to have succeeded.
 */
function reported(answer: { jobId: string | null; deduplicated: boolean }): boolean {
  return answer.jobId !== null || answer.deduplicated;
}

/** The typed grouping key, as the screen carries one between a door and the dialog. */
type GroupKey = OfferedGroupItem["key"];

/** One group the module offered, before this screen writes its sentence (I-86). */
export interface OfferedGroupData {
  readonly key: GroupKey;
  readonly label: string;
  readonly members: readonly string[];
}

export interface SheetIndexProps {
  tenantId: string;
  projectId: string;
  cards: readonly SheetCardData[];
  groups: readonly OfferedGroupData[];
  /** Whether this reader holds MEASURE on the project (I-90). */
  canConfirm: boolean;
  /** How many drawings are stored but not read through yet — the `awaiting-ingest` cause (I-91). */
  awaitingIngest: number;
  preview?: typeof previewConfirmDiscipline;
  commit?: typeof commitConfirmDiscipline;
  requestSheets?: typeof requestSheetsFor;
  requestThumbnails?: typeof requestThumbnailsFor;
}

/** Where a refusal is resolved: a place, named in the button voice (refusal-state § 3). */
interface Evidence {
  readonly href: string;
  readonly label: string;
}

/** Which door was pressed last, so its answer renders in its own slot and nowhere else. */
type Pressed = { readonly where: "groups" } | { readonly where: "card"; readonly sheetId: string };

export function SheetIndex({
  tenantId,
  projectId,
  cards,
  groups,
  canConfirm,
  awaitingIngest,
  preview = previewConfirmDiscipline,
  commit = commitConfirmDiscipline,
  requestSheets = requestSheetsFor,
  requestThumbnails = requestThumbnailsFor,
}: SheetIndexProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(ALL);
  const [items, setItems] = useState<DropzoneItem[]>([]);
  const [jobs, setJobs] = useState<TimelineJob[]>([]);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [pressed, setPressed] = useState<Pressed | null>(null);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(false);
  const [confirming, setConfirming] = useState<GroupKey | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const headingIds = { upload: useId(), sheets: useId() };
  const searchId = useId();

  // I-89: offline is what the browser says, and what a failed transfer confirms. The Dropzone stays
  // armed — the protocol resumes from the last acknowledged offset — and the act doors do not.
  useEffect(() => {
    const read = (): void => setOffline(typeof navigator === "object" && navigator !== null && navigator.onLine === false);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  const evidenceFor = useCallback(
    (code: RefusalCode): Evidence => {
      if (code === "PERMISSION_NOT_HELD") return { href: participantsRoute(tenantId, projectId), label: drawings.drawings_evidence_participants };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return { href: drawingsRoute(tenantId, projectId), label: drawings.drawings_evidence_reload };
    },
    [tenantId, projectId],
  );

  /** A refusal, in the shape the one act pattern rejects with and the one renderer composes. */
  const refused = useCallback((code: RefusalCode): unknown => ({ refusal: refusalOf(code), evidence: evidenceFor(code) }), [evidenceFor]);

  /** Everything one gesture gathered, carried to the upload doors and reported row by row. */
  const onFiles = useCallback(
    async (gathered: DropzoneFile[]): Promise<void> => {
      setItems((held) => [...held, ...gathered.map((file) => ({ name: file.name, progress: "", state: "queued" as const }))]);
      const outcomes = await uploadFiles(
        gathered.map((file) => ({ name: file.name, file: file.file })),
        {
          projectId,
          onProgress: (progress) => {
            setItems((held) => held.map((row) => (row.name === progress.name ? { ...row, state: progress.state === "failed" ? "refused" : progress.state } : row)));
          },
        },
      );

      const stored = outcomes.flatMap((outcome) => outcome.drawings.map((drawing) => drawing.drawingId));
      setItems((held) =>
        held.map((row) => {
          const outcome = outcomes.find((answered) => answered.name === row.name);
          if (outcome === undefined) return row;
          const state = outcome.state === "stored" ? (outcome.drawings.some((drawing) => drawing.duplicate) ? "duplicate" : "stored") : "refused";
          return outcome.refusal === undefined ? { ...row, state } : { ...row, state, refusal: outcome.refusal };
        }),
      );
      if (stored.length === 0) return;

      // A stored drawing is read straight away: the screen asks, and the answered jobs open the
      // timeline. The worker chains the previews itself once a record lands (I-88).
      const asked = await requestSheets({ projectId, drawingIds: stored });
      setJobs((held) => [...held, ...asked.filter(reported).map((answer) => ({ jobId: answer.jobId, kind: "ingest" as const, drawingId: answer.drawingId }))]);
    },
    [projectId, requestSheets],
  );

  /** I-88: the second step is asked for, never invented — the browser never holds that job id. */
  const onJobSucceeded = useCallback(
    async (job: TimelineJob): Promise<void> => {
      router.refresh();
      if (job.kind !== "ingest") return;
      const answer = await requestThumbnails({ projectId, drawingId: job.drawingId });
      if (!reported(answer)) return;
      setJobs((held) => (held.some((step) => step.kind === "thumbnails" && step.drawingId === job.drawingId) ? held : [...held, { jobId: answer.jobId, kind: "thumbnails", drawingId: job.drawingId }]));
    },
    [projectId, requestThumbnails, router],
  );

  const settled = useCallback(
    (job: TimelineJob): void => {
      void onJobSucceeded(job);
    },
    [onJobSucceeded],
  );

  /** I-94: case-folded fragments of the title, the number and the layout name; the filter reads the
      effective discipline — the same value the card publishes. */
  const shown = useMemo(() => {
    const asked = search.trim().toLowerCase();
    return cards.filter((card) => {
      const effective = card.confirmed === null ? card.proposal.discipline : card.confirmed.discipline;
      if (filter !== ALL && effective !== filter) return false;
      if (asked === "") return true;
      return [card.proposal.title, card.proposal.number ?? "", card.layoutName].some((value) => value.toLowerCase().includes(asked));
    });
  }, [cards, filter, search]);

  const dialogPreview = useCallback(async () => {
    if (confirming === null) throw new Error("the consequence dialog was opened with no group to preview");
    const answered: PreviewAnswer = await preview({ projectId, group: confirming });
    if (!answered.previewed) throw refused(answered.refusal);
    return { consequence: answered.consequence, consequenceDigest: answered.consequenceDigest };
  }, [confirming, preview, projectId, refused]);

  const dialogCommit = useCallback(
    async ({ consequenceDigest }: { consequenceDigest: string }) => {
      if (confirming === null) throw new Error("the consequence dialog committed with no group to carry");
      const answered: CommitAnswer = await commit({ projectId, group: confirming, consequenceDigest });
      if (!answered.committed) throw refused(answered.refusal);
      return { actId: answered.actId };
    },
    [commit, confirming, projectId, refused],
  );

  /** A door pressed: offline first (I-89), then the pre-check, then the dialog on a consequence. */
  const press = async (key: GroupKey, where: Pressed): Promise<void> => {
    if (pending) return;
    setPressed(where);
    setRefusal(null);
    setCommitted(false);
    setOfflineNotice(false);
    if (offline) {
      setOfflineNotice(true);
      return;
    }
    setPending(true);
    const answered = await preview({ projectId, group: key });
    setPending(false);
    if (!answered.previewed) {
      setRefusal(answered.refusal);
      return;
    }
    setConfirming(key);
    setDialogOpen(true);
  };

  /** The answer slot of one door: exactly one refusal, or the local offline notice (Decision § 1). */
  const answerFor = (where: Pressed): ReactNode => {
    if (pressed === null || pressed.where !== where.where) return null;
    if (pressed.where === "card" && where.where === "card" && pressed.sheetId !== where.sheetId) return null;
    if (offlineNotice) {
      return (
        <span className="cx-drawings-notice" role="alert">
          {drawings.drawings_offline_notice}
        </span>
      );
    }
    return refusal === null || pending ? null : <RefusalState refusal={refusalOf(refusal)} evidence={evidenceFor(refusal)} />;
  };

  const offered: OfferedGroupItem[] = groups.map((group) => ({
    key: group.key,
    label: fill(group.key.kind === "SHEET" ? drawings.drawings_group_label_sheet : drawings.drawings_group_label_discipline, {
      discipline: group.key.discipline,
      subject: group.label,
    }),
    count: fill(drawings.drawings_group_count, { count: formatUserFigure(String(group.members.length)) }),
  }));

  return (
    <div className="cx-drawings">
      <header className="cx-drawings-header">
        <h1 className="cx-drawings-heading">{drawings.drawings_heading}</h1>
        <p className="cx-drawings-caption">{drawings.drawings_caption}</p>
      </header>

      <section className="cx-drawings-section" aria-labelledby={headingIds.upload}>
        <h2 className="cx-drawings-section-heading" id={headingIds.upload}>
          {drawings.drawings_upload_heading}
        </h2>
        <p className="cx-drawings-hint">{drawings.drawings_upload_hint}</p>
        {offline ? (
          <div className="cx-drawings-offline" role="status">
            {drawings.drawings_offline}
          </div>
        ) : null}
        <Dropzone
          items={items}
          onFiles={(gathered) => {
            void onFiles(gathered);
          }}
        />
      </section>

      <JobTimeline jobs={jobs} onSucceeded={settled} />

      <section className="cx-drawings-section" aria-labelledby={headingIds.sheets}>
        <h2 className="cx-drawings-section-heading" id={headingIds.sheets}>
          {drawings.drawings_sheets_heading}
        </h2>
        <p className="cx-drawings-hint">{drawings.drawings_sheets_hint}</p>

        {/* I-90: the index and the groups stand whole for a reader without MEASURE — knowledge is
            not permission — and one banner names the permission and who holds it. */}
        {canConfirm ? null : (
          <div className="cx-drawings-denied">
            <p className="cx-drawings-denied-line">{drawings.drawings_denied_permission}</p>
            <p className="cx-drawings-denied-line">{drawings.drawings_denied_holder}</p>
            <RefusalState refusal={refusalOf("PERMISSION_NOT_HELD")} evidence={evidenceFor("PERMISSION_NOT_HELD")} />
          </div>
        )}

        <div className="cx-drawings-controls">
          <span className="cx-drawings-field">
            <label className="cx-drawings-field-label" htmlFor={searchId}>
              {drawings.drawings_search_label}
            </label>
            <Input id={searchId} className="cx-drawings-search" data-testid="sheet-search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </span>

          <fieldset className="cx-drawings-field">
            <legend className="cx-drawings-field-label">{drawings.drawings_filter_legend}</legend>
            <span className="cx-drawings-choices">
              <Chip data-testid="sheet-filter-option" data-value={ALL} selected={filter === ALL} onClick={() => setFilter(ALL)}>
                {drawings.drawings_filter_all}
              </Chip>
              {DISCIPLINES.map((discipline) => (
                <Chip className="cx-drawings-enum" key={discipline} data-testid="sheet-filter-option" data-value={discipline} selected={filter === discipline} onClick={() => setFilter(discipline)}>
                  {discipline}
                </Chip>
              ))}
            </span>
          </fieldset>

          <p className="cx-drawings-count" role="status">
            {fill(drawings.drawings_sheet_count, { shown: formatUserFigure(String(shown.length)), total: formatUserFigure(String(cards.length)) })}
          </p>
        </div>

        <p className="cx-drawings-hint">{drawings.drawings_groups_hint}</p>
        <OfferedGroups
          groups={offered}
          onConfirm={(key) => {
            void press(key, { where: "groups" });
          }}
        />
        <div className="cx-drawings-answer">{answerFor({ where: "groups" })}</div>
        <p className="cx-drawings-status" role="status" aria-live="polite">
          {pending ? drawings.drawings_confirm_pending : committed ? drawings.drawings_confirm_committed : ""}
        </p>

        {shown.length === 0 ? (
          <Empty cause={cards.length > 0 ? "no-match" : awaitingIngest > 0 ? "awaiting-ingest" : "no-drawings"} onClear={() => {
            setSearch("");
            setFilter(ALL);
          }} />
        ) : (
          <div className="cx-drawings-grid" data-testid="sheet-index">
            {shown.map((card) => (
              <SheetCard
                key={card.sheetId}
                card={card}
                canConfirm={canConfirm}
                answer={answerFor({ where: "card", sheetId: card.sheetId })}
                onConfirm={(sheetId, discipline) => {
                  void press({ kind: "SHEET", sheetId, discipline }, { where: "card", sheetId });
                }}
              />
            ))}
          </div>
        )}
      </section>

      <ConsequenceDialog
        open={dialogOpen}
        actType={ACT_TYPE}
        preview={dialogPreview}
        commit={dialogCommit}
        onOpenChange={setDialogOpen}
        onCommitted={() => {
          // The confirmed cards and the emptied group are the visible answer: both are server-read
          // from the ledger the act just appended to, so the screen re-reads and says so once.
          setConfirming(null);
          setCommitted(true);
          router.refresh();
        }}
      />
    </div>
  );
}

/** I-91: three causes, one element — and only the one a person can act on carries an action. */
function Empty({ cause, onClear }: { cause: "no-drawings" | "awaiting-ingest" | "no-match"; onClear: () => void }) {
  const words = {
    "no-drawings": { heading: drawings.drawings_empty_no_drawings_heading, body: drawings.drawings_empty_no_drawings_body },
    "awaiting-ingest": { heading: drawings.drawings_empty_awaiting_heading, body: drawings.drawings_empty_awaiting_body },
    "no-match": { heading: drawings.drawings_empty_no_match_heading, body: drawings.drawings_empty_no_match_body },
  }[cause];

  return (
    <div className="cx-drawings-empty" data-testid="sheets-empty" data-cause={cause}>
      <p className="cx-drawings-empty-heading">{words.heading}</p>
      <p className="cx-drawings-empty-body">{words.body}</p>
      {cause === "no-match" ? (
        <Button variant="ghost" onClick={onClear}>
          {drawings.drawings_empty_clear}
        </Button>
      ) : null}
    </div>
  );
}
