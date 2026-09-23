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
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DISCIPLINES, type Discipline } from "@/core/sheets/law";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { Dropzone, uploadFiles, type DropzoneFile, type DropzoneItem } from "@/ui/patterns/dropzone";
import { JobTimeline, useTrackedJobs, type TrackedJob } from "@/ui/patterns/job-timeline";
import { OfferedGroups, type OfferedGroupItem } from "@/ui/patterns/offered-group";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, Chip, EnumLabel, Input } from "@/ui/primitives/core";
import { fill, strings } from "@/ui/strings";
import { participantsRoute } from "../settings/participants/route-address";
import {
  commitConfirmDiscipline,
  previewConfirmDiscipline,
  requestSheetsFor,
  requestThumbnailsFor,
  type CommitAnswer,
  type PreviewAnswer,
} from "./actions";
import { drawingsRoute } from "./route-address";
import { DISCIPLINE_WORDS, SheetCard, cardName, type SheetCardData } from "./sheet-card";
import { drawings } from "./strings";
import { TESTIDS } from "@/ui/testids";

/** The act this screen renders (L-ACT-02's pair opens the one dialog under this name). */
const ACT_TYPE = "CONFIRM_DISCIPLINE";

/** The filter's own extra option: every discipline at once, and the default (Decision § 1). */
const ALL = "ALL";

/**
 * Whether an asked-for job is one the timeline reports (I-88). A job id is a step to follow, and a
 * deduplicated answer is a step already finished — the seam saying the work stands. An answer with
 * neither enqueued nothing and settled nothing: the request was refused, and its code is rendered in
 * place beside the queue that raised it (R-UI-020), never as a step that claims to have succeeded.
 */
function reported(answer: { jobId: string | null; deduplicated: boolean }): boolean {
  return answer.jobId !== null || answer.deduplicated;
}

/** The typed grouping key, as the screen carries one between a door and the dialog. */
/** §3.4's own two numbers: the offered strip shows three groups then "+N", and the job strip shows
    the last few steps of the run rather than every step of the session. */
const OFFERED_SHOWN = 3;
const STEPS_SHOWN = 4;

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

/**
 * I-429: the fold in the order a set is read — each drawing's sheets in its layout inventory's
 * order, then that drawing's model space. The module answers the inventory's own order, and model
 * space is the inventory's first layout in every DXF and DWG, so the fold opened on a card that is no
 * sheet of the set. Per drawing, not per index: with two drawings each model space still closes its
 * own drawing's run of sheets, which is what tells two "Model space" cards apart. `sort` is stable,
 * so nothing else moves.
 */
function inFoldOrder(cards: readonly SheetCardData[]): SheetCardData[] {
  const drawingAt = new Map<string, number>();
  for (const card of cards) if (!drawingAt.has(card.drawingId)) drawingAt.set(card.drawingId, drawingAt.size);
  const rank = (card: SheetCardData): number => (drawingAt.get(card.drawingId) ?? 0) * 2 + (card.kind === "model" ? 1 : 0);
  return [...cards].sort((one, other) => rank(one) - rank(other));
}

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
  const [filter, setFilter] = useState<Discipline | typeof ALL>(ALL);
  const [items, setItems] = useState<DropzoneItem[]>([]);
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [pressed, setPressed] = useState<Pressed | null>(null);
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(false);
  /** The code a request to read a stored drawing was refused with, if one was (R-UI-020). */
  const [askRefusal, setAskRefusal] = useState<RefusalCode | null>(null);
  const [confirming, setConfirming] = useState<GroupKey | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const headingIds = { upload: useId(), sheets: useId() };
  const addRegion = useRef<HTMLElement | null>(null);

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
      if (code === "PERMISSION_NOT_HELD" || code === "WORKSPACE_PERMISSION_NOT_HELD") return { href: participantsRoute(tenantId, projectId), label: drawings.drawings_evidence_participants };
      if (code === "SIGNED_OUT") return { href: "/sign-in", label: strings.shell_evidence_sign_in };
      return { href: drawingsRoute(tenantId, projectId), label: drawings.drawings_evidence_reload };
    },
    [tenantId, projectId],
  );

  /** Where a step that ended badly is resolved: this screen, with the drawing offered again. */
  const timelineEvidence = useMemo(() => ({ href: drawingsRoute(tenantId, projectId), label: drawings.drawings_evidence_upload_again }), [tenantId, projectId]);

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
      setJobs((held) => [...held, ...asked.filter(reported).map((answer) => ({ jobId: answer.jobId, kind: "ingest" as const, subject: answer.drawingId, evidence: timelineEvidence }))]);
      // A drawing the seam refused to read gets no step, and would otherwise be silence: the code it
      // was refused with renders beside the queue that produced the row (R-UI-020).
      setAskRefusal(asked.find((answer) => answer.refusal !== null)?.refusal ?? null);
    },
    [projectId, requestSheets, timelineEvidence],
  );

  /** I-88: the second step is asked for, never invented — the browser never holds that job id. */
  const onJobSucceeded = useCallback(
    async (job: TrackedJob): Promise<void> => {
      router.refresh();
      if (job.kind !== "ingest") return;
      const answer = await requestThumbnails({ projectId, drawingId: job.subject });
      // A door answered without the field — an older answer, or a stand-in built to the shape the
      // spec declares — is not a refusal: only a code the register holds may reach the renderer.
      const refusedWith = answer.refusal ?? null;
      if (refusedWith !== null) setAskRefusal(refusedWith);
      if (!reported(answer)) return;
      setJobs((held) =>
        held.some((step) => step.kind === "thumbnails" && step.subject === job.subject)
          ? held
          : [...held, { jobId: answer.jobId, kind: "thumbnails", subject: job.subject, evidence: timelineEvidence }],
      );
    },
    [projectId, requestThumbnails, router, timelineEvidence],
  );

  const settled = useCallback(
    (job: TrackedJob): void => {
      void onJobSucceeded(job);
    },
    [onJobSucceeded],
  );

  // One register, one watch per job (R-UI-024): the same readings stand in this timeline and in the
  // frame's jobs tray.
  const { steps, lost } = useTrackedJobs(jobs, { onSucceeded: settled });

  /** The index as the fold stands it: each drawing's sheets, then its model space (I-429). */
  const ordered = useMemo(() => inFoldOrder(cards), [cards]);

  /** I-94: case-folded fragments of the two lines a card publishes as its name — its title and the
      sheet number; the filter reads the effective discipline, the same value the card publishes as
      `data-discipline`. I-429: the title is the card's name, so model space is found by the words
      its card shows ("model") and never by the tallest text the grammar read in it, which it no
      longer shows; it states no number. */
  const shown = useMemo(() => {
    const asked = search.trim().toLowerCase();
    return ordered.filter((card) => {
      const effective = card.confirmed === null ? card.proposal.discipline : card.confirmed.discipline;
      if (filter !== ALL && effective !== filter) return false;
      if (asked === "") return true;
      return [cardName(card), card.kind === "model" ? "" : (card.proposal.number ?? "")].some((value) => value.toLowerCase().includes(asked));
    });
  }, [ordered, filter, search]);

  /** How many sheets stand at each discipline — the chips' counts (§3.4: "Structural 8 · MEP 1"),
      over the same effective discipline the filter compares (I-94). I-429: a chip counts the cards
      pressing it leaves standing, so model space counts at the discipline it stands at, as the count
      line, the offered group's count and the project home's tally count it — one card of the index. */
  const standing = useMemo(() => {
    const counted = Object.fromEntries(DISCIPLINES.map((discipline) => [discipline, 0])) as Record<Discipline, number>;
    for (const card of cards) counted[card.confirmed === null ? card.proposal.discipline : card.confirmed.discipline] += 1;
    return counted;
  }, [cards]);

  /** Each held card's name, by the sheet id an act moves (I-429; the participants I-55 precedent). */
  const names = useMemo(() => new Map(cards.map((card) => [card.sheetId, cardName(card)] as const)), [cards]);

  const dialogPreview = useCallback(async () => {
    if (confirming === null) throw new Error("the consequence dialog was opened with no group to preview");
    const answered: PreviewAnswer = await preview({ projectId, group: confirming });
    if (!answered.previewed) throw refused(answered.refusal);
    // The seam names each sheet by its proposed title, which for model space is the tallest text the
    // grammar read — one of the sheets' own titles, listed beside that sheet. The dialog is where a
    // person decides, so it lists each subject by the name its card wears; the label is presentation
    // the digest is blind to (consequence.ts), and the digest travels untouched (I-55). A subject no
    // card here holds keeps the seam's label.
    const named = {
      ...answered.consequence,
      subjects: answered.consequence.subjects.map((subject) => {
        const name = names.get(subject.subjectId);
        return name === undefined ? subject : { ...subject, subjectLabel: name };
      }),
    };
    return { consequence: named, consequenceDigest: answered.consequenceDigest };
  }, [confirming, names, preview, projectId, refused]);

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

  // A group's count is its membership, model space included where the grammar proposed it at the
  // group's discipline: the act confirms it with the rest, and the dialog lists it by name (I-429).
  const offered: OfferedGroupItem[] = groups.map((group) => ({
    key: group.key,
    label: fill(group.key.kind === "SHEET" ? drawings.drawings_group_label_sheet : drawings.drawings_group_label_discipline, {
      discipline: DISCIPLINE_WORDS[group.key.discipline],
      subject: group.label,
    }),
    count: fill(drawings.drawings_group_count, { count: formatUserFigure(String(group.members.length)) }),
  }));

  const addDrawings = (
    <section className="cx-drawings-section" aria-labelledby={headingIds.upload} ref={addRegion}>
      <h2 className="cx-drawings-section-heading" id={headingIds.upload}>
        {drawings.drawings_upload_heading}
      </h2>
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
      {/* A stored drawing the seam refused to read: no job, so no step — and never silence. */}
      {askRefusal === null ? null : (
        <div className="cx-drawings-answer">
          <RefusalState refusal={refusalOf(askRefusal)} evidence={evidenceFor(askRefusal)} />
        </div>
      )}
    </section>
  );

  /** The v22 frame's "↑ Add" (I-97, I-323): the header's door takes the reader to the one Dropzone and
      puts focus on its own file door — the Add region stays the one place a drawing is dropped. */
  const toAdd = (): void => {
    const region = addRegion.current;
    if (region === null) return;
    region.scrollIntoView({ block: "start" });
    region.querySelector<HTMLElement>(`[data-testid="${TESTIDS.dropzone.browse}"]`)?.focus();
  };

  return (
    <div className="cx-drawings" data-screen-root="" data-state={cards.length === 0 ? "empty" : "ready"}>
      {/* I-323: the v22 frame's header is ONE row — the title, the discipline chips with their
          counts, the search, the count and Add. The chips keep their legend, clipped from sight, and
          the search names itself: the row says what they are by what they hold. */}
      <header className="cx-drawings-header">
        <h1 className="cx-drawings-heading">{drawings.drawings_heading}</h1>

        <fieldset className="cx-drawings-field">
          <legend className="cx-drawings-hidden">{drawings.drawings_filter_legend}</legend>
          <span className="cx-drawings-choices">
            <Chip data-testid={TESTIDS.sheet.filterOption} data-value={ALL} selected={filter === ALL} onClick={() => setFilter(ALL)}>
              {drawings.drawings_filter_all}
              <span className="cx-drawings-chip-count">{formatUserFigure(String(cards.length))}</span>
            </Chip>
            {DISCIPLINES.map((discipline) => (
              <Chip key={discipline} data-testid={TESTIDS.sheet.filterOption} data-value={discipline} selected={filter === discipline} onClick={() => setFilter(discipline)}>
                <EnumLabel value={discipline} label={DISCIPLINE_WORDS[discipline]} />
                <span className="cx-drawings-chip-count">{formatUserFigure(String(standing[discipline]))}</span>
              </Chip>
            ))}
          </span>
        </fieldset>

        <span className="cx-drawings-tools">
          {/* The field names itself (the projects-home precedent): its accessible name and its
              placeholder are the same words, so an empty field still says what it is (I-323). */}
          <Input
            className="cx-drawings-search"
            data-testid={TESTIDS.sheet.search}
            aria-label={drawings.drawings_search_label}
            placeholder={drawings.drawings_search_label}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p className="cx-drawings-count" role="status">
            {fill(drawings.drawings_sheet_count, { shown: formatUserFigure(String(shown.length)), total: formatUserFigure(String(cards.length)) })}
          </p>
          {cards.length === 0 ? null : (
            <Button variant="secondary" onClick={toAdd}>
              {drawings.drawings_upload_heading}
            </Button>
          )}
        </span>
      </header>

      {/* I-97: with no card the Add region is the screen's teaching frame and stands first; with cards
          the grid is the primary region and Add follows it, so the work surface begins within the
          fold (the v22 frame's "↑ Add" reading of §3.4). */}
      {cards.length === 0 ? addDrawings : null}

      {/* I-109: the ingest is not the whole chain — until the thumbnails job the worker chains after
          it has been asked for, this region is still running however well the ingest went. */}
      {/* §3.4: "the job timeline appears inline above the grid ONLY while a job runs, then collapses
          to the jobs tray". With no job there is no strip — a region with nothing in it is absent,
          not a placeholder (R-UI-080) — and while one runs it shows the last few steps, not a column
          of every step the session ever took. */}
      {steps.length === 0 && !lost ? null : (
      <JobTimeline
        heading={drawings.drawings_timeline_heading}
        steps={steps.slice(-STEPS_SHOWN)}
        lost={lost}
        awaiting={jobs.some((job) => job.kind === "ingest") && !jobs.some((job) => job.kind === "thumbnails")}
      />
      )}

      <section className="cx-drawings-section" aria-labelledby={headingIds.sheets}>
        {/* The section names itself for the outline; the h1 already says it to the eye, and a
            "Sheets" heading under "Drawings" said the same thing twice (I-323). */}
        <h2 className="cx-drawings-hidden" id={headingIds.sheets}>
          {drawings.drawings_sheets_heading}
        </h2>

        {/* I-90: the index and the groups stand whole for a reader without MEASURE — knowledge is
            not permission — and one banner names the permission and who holds it. */}
        {canConfirm ? null : (
          <div className="cx-drawings-denied">
            <p className="cx-drawings-denied-line">{drawings.drawings_denied_permission}</p>
            <p className="cx-drawings-denied-line">{drawings.drawings_denied_holder}</p>
            <RefusalState refusal={refusalOf("PERMISSION_NOT_HELD")} evidence={evidenceFor("PERMISSION_NOT_HELD")} />
          </div>
        )}

        {/* §3.4: "36 px per group, max 3 then +N". The fan-out that stacked every group down one
            column is the reason this screen was 3 168 px tall and needed a height budget of its own
            (tests/e2e/support/height-budget.ts) — a strip is a strip at any number of groups. With
            no group offered the strip is absent (the region table's "Empty: absent", R-UI-080): the
            pattern's own none-sentence spent a line and a gap saying nothing a reader could act on. */}
        {offered.length === 0 ? null : (
          <OfferedGroups
            groups={offered.slice(0, OFFERED_SHOWN)}
            onConfirm={(key) => {
              void press(key, { where: "groups" });
            }}
          />
        )}
        {offered.length > OFFERED_SHOWN ? (
          <p className="cx-drawings-more" data-testid={TESTIDS.sheet.offeredMore}>
            {fill(drawings.drawings_group_count, { count: formatUserFigure(String(offered.length - OFFERED_SHOWN)) })}
          </p>
        ) : null}
        {/* An answer slot and a status line with nothing in them leave the flow (the shell's one
            live-region idiom), so they pay no gap until they have something to say. */}
        <div className="cx-drawings-answer cx-shell-live">{answerFor({ where: "groups" })}</div>
        <p className="cx-drawings-status cx-shell-live" role="status" aria-live="polite">
          {pending ? drawings.drawings_confirm_pending : committed ? drawings.drawings_confirm_committed : null}
        </p>

        {shown.length === 0 ? (
          <Empty
            cause={cards.length > 0 ? "no-match" : awaitingIngest > 0 ? "awaiting-ingest" : "no-drawings"}
            search={search.trim()}
            discipline={filter === ALL ? null : filter}
            onClear={() => {
              setSearch("");
              setFilter(ALL);
            }}
          />
        ) : (
          <div className="cx-drawings-grid" data-testid={TESTIDS.sheet.index} data-rendered-region data-state="settled">
            {/* THE RENDERED CONTRACT (v22 speed, tests/e2e/support/settled.ts): the grid renders
                every card it was handed in ONE pass, so by the time this element exists the list is
                whole — and a retrying read that knows it takes one reading, not three agreeing
                ones. `data-rendered-region` is what says this element's `data-state` IS that
                contract; a bare `data-state` is Radix's word for a popover being open. */}
            {shown.map((card) => (
              <SheetCard
                key={card.sheetId}
                card={card}
                tenantId={tenantId}
                projectId={projectId}
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

      {cards.length > 0 ? addDrawings : null}

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

/**
 * I-91: three causes, one element — and only the one a person can act on carries an action.
 *
 * A `no-match` emptiness also says what is doing the excluding: the words searched for, the
 * discipline chipped, or both. An empty index that does not name its own filter reads as "there are
 * no sheets" when the truth is "none of them answer to this" (R-UI-050's honest empty).
 */
export interface EmptyProps {
  readonly cause: "no-drawings" | "awaiting-ingest" | "no-match";
  readonly search: string;
  /**
   * The chip in force, as the closed enum the whole sheets lane is written over — never a bare
   * string. A prop widened to `string` throws the union away at the last hop, and a discipline that
   * is not one reaches the rendered sentence as data (B-17).
   */
  readonly discipline: Discipline | null;
  readonly onClear: () => void;
}

function Empty({ cause, search, discipline, onClear }: EmptyProps) {
  const words = {
    "no-drawings": { heading: drawings.drawings_empty_no_drawings_heading, body: drawings.drawings_empty_no_drawings_body },
    "awaiting-ingest": { heading: drawings.drawings_empty_awaiting_heading, body: drawings.drawings_empty_awaiting_body },
    "no-match": { heading: drawings.drawings_empty_no_match_heading, body: drawings.drawings_empty_no_match_body },
  }[cause];
  const named = cause === "no-match" ? namedFilter(search, discipline) : null;

  return (
    <div className="cx-drawings-empty" data-testid={TESTIDS.sheets.empty} data-cause={cause}>
      <p className="cx-drawings-empty-heading">{words.heading}</p>
      {named === null ? null : <p className="cx-drawings-empty-filter">{named}</p>}
      <p className="cx-drawings-empty-body">{words.body}</p>
      {cause === "no-match" ? (
        <Button variant="ghost" onClick={onClear}>
          {drawings.drawings_empty_clear}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The sentence that names the filter in force, in the words the person set it with: the searched
 * text verbatim (it is theirs, not the product's) and the chipped discipline in the words its chip
 * reads (I-323, amending I-25's enum-as-data reading for this sentence). Nothing is filtering when neither stands, and then there is no sentence to write.
 */
function namedFilter(search: string, discipline: Discipline | null): string | null {
  // The discipline is said as the chip that set it says it (R-UI-082, I-323): in words, not as the enum.
  const said = discipline === null ? null : DISCIPLINE_WORDS[discipline];
  if (search !== "" && said !== null) return fill(drawings.drawings_empty_no_match_both, { search, discipline: said });
  if (search !== "") return fill(drawings.drawings_empty_no_match_search, { search });
  if (said !== null) return fill(drawings.drawings_empty_no_match_discipline, { discipline: said });
  return null;
}
