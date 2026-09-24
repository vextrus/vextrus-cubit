"use client";
// S-Ask, bound (docs/design/s-ask.md): the question band, the thread of answers newest first, and
// every state R-UI-050 rules. The engine answers FACTS; `./present` writes them in the string table's
// words; this file renders what `./present` wrote through the shipped primitives and composes no
// sentence of its own (I-398).
//
// The thread is kept in the tab (`./thread`, I-403): restored on arrival with no request, so Back
// from the viewer re-asks nothing. A question in the address is asked once and the address is then
// replaced by the bare route. One question at a time, so answers never land out of order.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import type { AskAnswer, AskReading } from "@/modules/takeoff/ask/law";
import { EvidenceLink } from "@/ui/patterns/evidence-link";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { tabStore } from "@/ui/patterns/tab-store";
import { Button, EmptyState, EnumLabel, ErrorState, IdChip, Input, RelativeTime, Skeleton, Tooltip, UnitBadge } from "@/ui/primitives/core";
import { DataTable, type DataTableColumnDef } from "@/ui/primitives/data";
import { useShellPage } from "@/ui/shell";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { useTakeoffTabsAside } from "../nav";
import type { AskDoorAnswer, AskAsk } from "./actions";
import {
  basisWords,
  breakdownOf,
  evidenceId,
  heldLine,
  linelessMarks,
  offeredLabel,
  partialRowsOf,
  placeHref,
  qualifierOf,
  readingWords,
  recordCount,
  refusalEvidence,
  rowsId,
  rowsTablesOf,
  sheetName,
  statementRows,
  unitOfFacts,
  type Links,
  type Row,
  type Seg,
  type Table,
} from "./present";
import { askRoute } from "./route-address";
import { askStateOf, type AskState } from "./states";
import { THREAD_CAP, articleStateOf, keep, keptReading, previousReading, readOrigin, readThread, threadKey, writeOrigin, writeThread, type KeptAnswer } from "./thread";

/** What the page read once on arrival (`askArrivalOf`). */
export type AskArrivalView = {
  readonly campaign: { readonly campaignId: string; readonly setRevisionId: string } | null;
  readonly stamp: string;
  readonly example: { readonly class: string; readonly mark: string; readonly level: string } | null;
};

/** The one door, as the screen calls it — the server action, or a suite's own. */
export type AskDoor = (projectId: string, ask: AskAsk) => Promise<AskDoorAnswer>;

/** A demonstration of one state (`./demonstration`): the thread and the flags it stands on. */
export type AskDemonstration = {
  readonly state: AskState | null;
  readonly thread: readonly KeptAnswer[];
  readonly offline: boolean;
};

export interface AskScreenProps {
  readonly tenantId: string;
  readonly projectId: string;
  readonly userId: string;
  /** What the page read; null where the read failed (`reportId` then says why) or the reader is denied. */
  readonly arrival: AskArrivalView | null;
  /** Whether the reader is a participant on this project (I-406). */
  readonly participant: boolean;
  readonly reportId: string | null;
  /** A question the address carried (`?q=`), asked once on arrival. */
  readonly question: string | null;
  readonly door: AskDoor;
  readonly demonstration?: AskDemonstration | null;
  /** The tab's store; the browser's own unless a suite hands in another. */
  readonly storage?: Storage | null;
}

/** The lane's tabs row, filled by the surface standing in it (Direction §3.2). */
function TabsAside({ children }: { children?: ReactNode }) {
  return useTakeoffTabsAside(children ?? null);
}

/** An id for a new answer. */
function newId(): string {
  return globalThis.crypto.randomUUID();
}

/* ------------------------------------------------------------------------------ segments */

function Segments({ segs }: { segs: readonly Seg[] }): ReactNode {
  return (
    <>
      {segs.map((seg, index) => {
        const key = `${index}`;
        switch (seg.t) {
          case "text":
            return <span key={key}>{seg.text}</span>;
          case "code":
            return (
              <span key={key} className="cx-ask-code">
                {seg.text}
              </span>
            );
          case "figure":
            return (
              <EvidenceLink
                key={key}
                href={seg.href}
                basis={seg.basis}
                label={seg.face}
                data-figure=""
                data-value={seg.figure.value}
                data-unit={seg.figure.unit ?? undefined}
                data-places={String(seg.figure.places)}
              />
            );
          case "unit":
            return <UnitBadge key={key} unit={seg.unit} />;
          case "quote":
            return seg.href === null ? (
              <q key={key} className="cx-ask-quote">
                {seg.text}
              </q>
            ) : (
              <EvidenceLink key={key} href={seg.href} basis="TRANSCRIBED" label={seg.text} data-quote="" />
            );
          case "link":
            return <EvidenceLink key={key} href={seg.href} basis={seg.basis} label={seg.label} />;
          case "enum":
            return <EnumLabel key={key} value={seg.value} />;
        }
      })}
    </>
  );
}

/** One of an answer's tables, through the shipped DataTable (I-171's wrapper carries its id). */
function AnswerTable({ table, testId }: { table: Table; testId: string }): ReactNode {
  const columns = useMemo<DataTableColumnDef<Row>[]>(
    () =>
      table.columns.map((column) => ({
        id: column.id,
        header: column.header,
        size: column.numeric ? 120 : 160,
        ...(column.numeric ? { meta: { align: "right" as const } } : {}),
        cell: ({ row }: { row: { original: Row } }) => <Segments segs={row.original.cells[column.id] ?? []} />,
      })) as DataTableColumnDef<Row>[],
    [table.columns],
  );
  return (
    <div className="cx-ask-table" data-testid={testId} data-table={table.tableId} data-rows={table.rows.length} style={{ ["--cx-ask-table-rows" as string]: String(Math.min(table.rows.length, testId === TESTIDS.ask.rowsTable ? 12 : 10)) }}>
      <DataTable tableId={table.tableId} columns={columns} data={[...table.rows]} getRowId={(row) => row.id} />
    </div>
  );
}

/* ------------------------------------------------------------------------------ an article */

type ArticleDoors = {
  readonly choose: (kept: KeptAnswer, reading: AskReading) => void;
  readonly decline: (kept: KeptAnswer) => void;
  readonly again: (kept: KeptAnswer) => void;
};

function Understood({ reading, qualifier, routedBy }: { reading: AskReading; qualifier: string | null; routedBy: string }): ReactNode {
  const words = readingWords(reading);
  return (
    <div className="cx-ask-understood" data-testid={TESTIDS.ask.understood} data-routed-by={routedBy}>
      <span className="cx-ask-caption">{strings.ask_understood_label}</span>
      <span className="cx-ask-reading">
        {words.map((word, index) => (
          <span key={index}>
            {index === 0 ? null : <span aria-hidden="true"> · </span>}
            <Segments segs={word} />
          </span>
        ))}
      </span>
      {qualifier === null ? null : routedBy === "MODEL" ? (
        <Tooltip content={strings.ask_understood_machine_hint}>
          <span className="cx-ask-qualifier" tabIndex={0}>
            {qualifier}
          </span>
        </Tooltip>
      ) : (
        <span className="cx-ask-qualifier">{qualifier}</span>
      )}
    </div>
  );
}

function Answered({
  kept,
  answer,
  links,
  stamp,
  blocked,
  live,
  doors,
}: {
  kept: KeptAnswer;
  answer: Extract<AskAnswer, { outcome: "ANSWERED" }>;
  links: Links;
  stamp: string;
  blocked: boolean;
  /** The newest answer's body alone is announced: a kept answer is not news (§1.1 3). */
  live: boolean;
  doors: ArticleDoors;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const rows = statementRows(answer, links);
  const breakdown = breakdownOf(answer, links);
  const partial = answer.facts.partial === null ? null : partialRowsOf(answer.facts.partial, answer.reading, answer.facts.statement.intent === "WHY_NOT_MEASURED", linelessMarks(answer));
  const count = recordCount(answer.facts);
  return (
    <>
      <Understood reading={answer.reading} qualifier={qualifierOf(answer, unitOfFacts(answer.facts.statement))} routedBy={answer.routedBy} />
      <div className="cx-ask-body" data-testid={TESTIDS.ask.body} aria-live={live ? "polite" : undefined}>
        {rows.map((row, index) => (
          <p key={index} className="cx-ask-statement">
            <Segments segs={row} />
          </p>
        ))}
        {breakdown === null ? null : <AnswerTable table={breakdown} testId={TESTIDS.ask.breakdown} />}
      </div>
      {partial === null ? null : (
        <div className="cx-ask-partial" data-testid={TESTIDS.ask.partial}>
          {[partial.lines, partial.objects].map((block, at) => (
            <div key={at} className="cx-ask-partial-block">
              {block.lead === null ? null : (
                <p className="cx-ask-partial-lead">
                  {block.lead}
                  {block.marks.length > 0 ? (
                    <>
                      {" "}
                      <Segments segs={block.marks.flatMap((mark, index): Seg[] => (index === 0 ? [{ t: "code", text: mark }] : [{ t: "text", text: " · " }, { t: "code", text: mark }]))} />
                    </>
                  ) : null}
                </p>
              )}
              {block.rows.length === 0 ? null : (
                <ul className="cx-ask-partial-rows">
                  {block.rows.map((row) => (
                    <li key={row.key}>
                      {row.remedy === null ? (
                        row.text
                      ) : (
                        <Tooltip content={row.remedy}>
                          <span tabIndex={0}>{row.text}</span>
                        </Tooltip>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {answer.facts.places.length === 0 ? null : (
        <div className="cx-ask-evidence" data-testid={TESTIDS.ask.evidence} id={evidenceId(kept.id)}>
          <span className="cx-ask-caption">{strings.ask_show_label}</span>
          {answer.facts.places.map((place) => (
            <a
              key={`${place.drawingId}|${place.layoutName}`}
              className="cx-ask-show cx-reticle"
              data-testid={TESTIDS.ask.show}
              data-drawing={place.drawingId}
              data-layout={place.layoutName}
              data-keys={place.keys.join(" ")}
              href={placeHref(links, place)}
            >
              <span className="cx-ask-show-glyph" aria-hidden="true">
                ◎
              </span>
              {sheetName(place)}
            </a>
          ))}
        </div>
      )}
      {count === 0 ? null : (
        <details className="cx-ask-rows" data-testid={TESTIDS.ask.rows} id={rowsId(kept.id)} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
          <summary className="cx-reticle">{fill(strings.ask_rows, { count: String(count) })}</summary>
          {open
            ? rowsTablesOf(answer.facts, links).map((one) => (
                <AnswerTable key={one.tableId} table={one} testId={TESTIDS.ask.rowsTable} />
              ))
            : null}
        </details>
      )}
      <Basis basis={basisWords(answer.facts.basis)} />
      {kept.stamp === stamp ? null : (
        <div className="cx-ask-stale" data-testid={TESTIDS.ask.stale}>
          <span>{strings.ask_stale}</span>
          <Button variant="ghost" data-testid={TESTIDS.ask.again} disabled={blocked} onClick={() => doors.again(kept)}>
            {strings.ask_again}
          </Button>
        </div>
      )}
    </>
  );
}

/** Where an answer was read from, and the revision it read (§1.1 7). */
function Basis({ basis }: { basis: string }): ReactNode {
  const revision = useContext(RevisionContext);
  return (
    <p className="cx-ask-basis" data-testid={TESTIDS.ask.basis}>
      <span>{basis}</span>
      {revision === null ? null : (
        <>
          <span aria-hidden="true"> · </span>
          <span>{strings.ask_revision_label}</span> <IdChip value={revision} />
        </>
      )}
    </p>
  );
}

/** The revision every answer on this page reads, for each answer's basis row (§1.1 7). */
const RevisionContext = createContext<string | null>(null);

function refusalEntryOf(code: string): RefusalEntry {
  return (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code] ?? REFUSALS.ASK_NOT_UNDERSTOOD;
}

function Article({
  kept,
  answering,
  origin,
  links,
  stamp,
  blocked,
  newest,
  doors,
}: {
  kept: KeptAnswer;
  answering: boolean;
  origin: boolean;
  links: Links;
  stamp: string;
  blocked: boolean;
  newest: boolean;
  doors: ArticleDoors;
}): ReactNode {
  const state = articleStateOf(kept, answering);
  const answer = answering ? null : kept.answer;
  const refusedCode = kept.refusal ?? (kept.declined ? REFUSALS.ASK_NOT_UNDERSTOOD.code : answer?.outcome === "REFUSED" ? answer.code : null);
  const questionId = `ask-q-${kept.id}`;
  const reading = answer === null ? null : answer.outcome === "ANSWERED" ? answer.reading : answer.outcome === "REFUSED" ? answer.reading : null;
  return (
    <article
      className="cx-ask-answer"
      data-testid={TESTIDS.ask.answer}
      aria-labelledby={questionId}
      data-answer={state}
      data-intent={reading?.intent}
      data-routed-by={answer?.outcome === "ANSWERED" ? answer.routedBy : undefined}
      data-stamp={kept.stamp}
      data-code={state === "refused" ? (refusedCode ?? undefined) : undefined}
      data-origin={origin ? "true" : undefined}
      data-answer-id={kept.id}
    >
      <header className="cx-ask-head">
        <h2 className="cx-ask-question" id={questionId} data-testid={TESTIDS.ask.question} title={kept.question}>
          {kept.question}
        </h2>
        <span className="cx-ask-asked" data-testid={TESTIDS.ask.asked}>
          {strings.ask_asked_label} <RelativeTime at={new Date(kept.askedAt)} />
        </span>
      </header>
      {state === "answering" ? (
        <div className="cx-ask-bones">
          <Skeleton className="cx-ask-bone" style={{ width: "60%" }} />
          <Skeleton className="cx-ask-bone" style={{ width: "80%" }} />
          <Skeleton className="cx-ask-bone" style={{ width: "40%" }} />
        </div>
      ) : state === "failed" ? (
        <ErrorState
          heading={strings.ask_failed_heading}
          body={strings.ask_failed_body}
          reportId={kept.fault ?? undefined}
          retryLabel={strings.ask_again}
          onRetry={blocked ? undefined : () => doors.again(kept)}
          data-testid={TESTIDS.error.state}
        />
      ) : state === "clarify" && answer?.outcome === "CLARIFY" ? (
        <div className="cx-ask-clarify" data-testid={TESTIDS.ask.clarify} role="group" aria-label={answer.lead === "COMPOUND" ? strings.ask_clarify_two : strings.ask_clarify_lead}>
          <p className="cx-ask-statement">{answer.lead === "COMPOUND" ? strings.ask_clarify_two : strings.ask_clarify_lead}</p>
          <div className="cx-ask-readings">
            {answer.offered.map((offered) => (
              <Button key={JSON.stringify(offered.reading)} variant="secondary" data-testid={TESTIDS.ask.reading} data-reading={JSON.stringify(offered.reading)} disabled={blocked} onClick={() => doors.choose(kept, offered.reading)}>
                {offeredLabel(offered)}
              </Button>
            ))}
            <Button variant="ghost" data-testid={TESTIDS.ask.readingNone} disabled={blocked} onClick={() => doors.decline(kept)}>
              {strings.ask_reading_none}
            </Button>
          </div>
        </div>
      ) : state === "refused" ? (
        <>
          {reading === null ? null : <Understood reading={reading} qualifier={null} routedBy="GRAMMAR" />}
          <RefusalState refusal={refusalEntryOf(refusedCode ?? REFUSALS.ASK_NOT_UNDERSTOOD.code)} evidence={refusalEvidence(refusedCode ?? "", links.tenantId, links.projectId)} />
          {answer?.outcome === "REFUSED" && answer.held !== null ? (
            <p className="cx-ask-held" data-testid={TESTIDS.ask.held}>
              <Segments segs={heldLine(answer.held)} />
            </p>
          ) : null}
        </>
      ) : answer?.outcome === "ANSWERED" ? (
        <Answered kept={kept} answer={answer} links={links} stamp={stamp} blocked={blocked} live={newest} doors={doors} />
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------------------ the screen */

export function AskScreen({ tenantId, projectId, userId, arrival, participant, reportId, question, door, demonstration, storage }: AskScreenProps) {
  const router = useRouter();
  useShellPage(strings.takeoff_nav_ask);

  const store = storage === undefined ? tabStore() : storage;
  const key = threadKey(userId, tenantId, projectId);
  const demonstrated = demonstration ?? null;

  const [online, setOnline] = useState(true);
  const [thread, setThread] = useState<readonly KeptAnswer[] | null>(demonstrated === null ? null : demonstrated.thread);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const asked = useRef<string | null>(null);

  useEffect(() => {
    const settle = (): void => setOnline(navigator.onLine);
    settle();
    window.addEventListener("online", settle);
    window.addEventListener("offline", settle);
    return () => {
      window.removeEventListener("online", settle);
      window.removeEventListener("offline", settle);
    };
  }, []);

  // The kept thread, restored with no request (I-403); the answer a link was followed from wears the
  // origin mark and is brought into view.
  useEffect(() => {
    if (demonstrated !== null) return;
    const restored = readThread(store, key);
    setThread(restored);
    const followed = readOrigin(store, key);
    if (followed !== null && restored.some((one) => one.id === followed)) setOrigin(followed);
  }, [demonstrated, key, store]);

  useEffect(() => {
    if (origin === null) return;
    document.querySelector(`[data-answer-id="${origin}"]`)?.scrollIntoView({ block: "nearest" });
  }, [origin]);

  const stamp = arrival?.stamp ?? "";
  const offline = demonstrated?.offline ?? !online;
  const blocked = offline || answeringId !== null || demonstrated !== null;

  const commit = useCallback(
    (next: readonly KeptAnswer[]) => {
      setThread(next);
      if (demonstrated === null) writeThread(store, key, next);
    },
    [demonstrated, key, store],
  );

  /** Ask one statement into an article — a new one at the head, or one already standing. */
  const askInto = useCallback(
    async (current: readonly KeptAnswer[], id: string, questionAsked: string, statement: { reading?: AskReading; previous?: AskReading }, inPlace: boolean) => {
      const pending: KeptAnswer = { id, question: questionAsked, askedAt: new Date().toISOString(), stamp, answer: null, refusal: null, fault: null, previous: statement.previous ?? null, declined: false };
      const standing = inPlace ? current.map((one) => (one.id === id ? pending : one)) : keep(current, pending);
      setThread(standing);
      setAnsweringId(id);
      const answered = await door(projectId, { question: questionAsked, ...statement });
      const settled: KeptAnswer = {
        ...pending,
        answer: answered.ok ? answered.answer : null,
        refusal: !answered.ok && "refusal" in answered ? answered.refusal : null,
        fault: !answered.ok && "fault" in answered ? answered.fault : null,
      };
      setAnsweringId(null);
      commit(standing.map((one) => (one.id === id ? settled : one)));
    },
    [commit, door, projectId, stamp],
  );

  const ask = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "" || thread === null || blocked) return;
      const previous = previousReading(thread);
      void askInto(thread, newId(), trimmed, previous === null ? {} : { previous }, false);
    },
    [askInto, blocked, thread],
  );

  // A question the address carried is asked ONCE, then the address is the bare route (I-403).
  useEffect(() => {
    if (question === null || thread === null || demonstrated !== null) return;
    if (asked.current === question) return;
    asked.current = question;
    router.replace(askRoute(tenantId, projectId));
    if (arrival?.campaign !== null && arrival !== null && participant && !offline) ask(question);
  }, [arrival, ask, demonstrated, offline, participant, projectId, question, router, tenantId, thread]);

  const doors = useMemo<ArticleDoors>(
    () => ({
      choose: (kept, reading) => {
        if (thread === null) return;
        void askInto(thread, kept.id, kept.question, { reading }, true);
      },
      decline: (kept) => {
        if (thread === null) return;
        commit(thread.map((one) => (one.id === kept.id ? { ...one, declined: true } : one)));
      },
      again: (kept) => {
        if (thread === null) return;
        const reading = keptReading(kept);
        void askInto(thread, kept.id, kept.question, reading === null ? (kept.previous === null ? {} : { previous: kept.previous }) : { reading }, true);
      },
    }),
    [askInto, commit, thread],
  );

  const clear = (): void => {
    commit([]);
    writeOrigin(store, key, null);
    setOrigin(null);
  };

  /** A link followed out of an article marks it as the origin a return is brought back to (I-403). */
  const followed = (event: React.MouseEvent<HTMLElement>): void => {
    const target = event.target as HTMLElement;
    const link = target.closest("a");
    const article = target.closest("[data-answer-id]");
    if (link === null || article === null) return;
    const id = article.getAttribute("data-answer-id");
    if (id !== null) writeOrigin(store, key, id);
  };

  const campaign = arrival?.campaign ?? null;
  const newestState = thread === null || thread[0] === undefined ? null : articleStateOf(thread[0], thread[0].id === answeringId);
  const derived = askStateOf({
    loading: thread === null && participant && reportId === null,
    denied: !participant,
    offline,
    readFailed: reportId !== null,
    campaign: campaign !== null,
    newest: newestState === "answering" ? null : newestState,
  });
  const state = demonstrated?.state ?? derived;

  const exampleQuestion =
    arrival?.example === null || arrival?.example === undefined
      ? strings.ask_example_sheets
      : fill(strings.ask_example_count, {
          classes: (strings as unknown as Record<string, string | undefined>)[`ask_class_${arrival.example.class}_other`] ?? arrival.example.class,
          mark: arrival.example.mark,
          level: arrival.example.level,
        });

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (draft.trim() === "") return;
    ask(draft);
    setDraft("");
  };

  const aside =
    campaign === null || !participant ? null : (
      <span className="cx-ask-aside">
        <span className="cx-ask-caption">{strings.ask_revision_label}</span>
        <IdChip value={campaign.setRevisionId} data-testid={TESTIDS.ask.revision} />
      </span>
    );

  const kept = thread ?? [];
  const links = (answer: KeptAnswer): Links => ({
    tenantId,
    projectId,
    answerId: answer.id,
    anyPlace: answer.answer?.outcome === "ANSWERED" && answer.answer.facts.places.length > 0,
  });

  return (
    <div
      className="cx-ask"
      data-testid={TESTIDS.ask.screen}
      data-screen-root=""
      data-state={state}
      data-campaign={campaign?.campaignId}
      data-answers={String(kept.length)}
      data-answering={answeringId === null ? undefined : "true"}
    >
      <TabsAside>{aside}</TabsAside>
      <h1 className="cx-ask-name">{strings.takeoff_nav_ask}</h1>
      {state === "denied" ? (
        <div className="cx-ask-denied">
          <p className="cx-ask-statement">{strings.ask_denied_permission}</p>
          <p className="cx-ask-caption">{strings.ask_denied_holder}</p>
          <RefusalState refusal={REFUSALS.PERMISSION_NOT_HELD} evidence={refusalEvidence(REFUSALS.PERMISSION_NOT_HELD.code, tenantId, projectId)} />
        </div>
      ) : reportId !== null ? (
        <ErrorState heading={strings.ask_error_heading} body={strings.ask_error_body} reportId={reportId} retryLabel={strings.ask_retry} onRetry={() => router.refresh()} data-testid={TESTIDS.error.state} />
      ) : campaign === null && demonstrated === null ? (
        <EmptyState heading={strings.ask_empty_no_campaign_heading} body={strings.ask_empty_no_campaign_body} data-testid={TESTIDS.ask.empty}>
          <a className="cx-btn cx-reticle" data-variant="primary" href={`/t/${tenantId}/p/${projectId}/drawings/sets`}>
            {strings.ask_empty_no_campaign_action}
          </a>
        </EmptyState>
      ) : (
        <>
          <form className="cx-ask-band" role="search" data-testid={TESTIDS.ask.form} onSubmit={submit}>
            <Input
              className="cx-ask-field"
              data-testid={TESTIDS.ask.field}
              aria-label={strings.ask_field_label}
              placeholder={strings.ask_field_placeholder}
              maxLength={300}
              value={draft}
              aria-disabled={offline || answeringId !== null ? "true" : undefined}
              readOnly={offline}
              onChange={(event) => setDraft(event.currentTarget.value)}
            />
            <Button type="submit" data-testid={TESTIDS.ask.submit} loading={answeringId !== null} disabled={offline || draft.trim() === ""}>
              {strings.ask_submit}
            </Button>
            {kept.length === 0 ? null : (
              <Tooltip content={strings.ask_clear_hint}>
                <Button variant="ghost" data-testid={TESTIDS.ask.clear} disabled={answeringId !== null} onClick={clear}>
                  {strings.ask_clear}
                </Button>
              </Tooltip>
            )}
          </form>
          <p className="cx-ask-status" role="status" data-testid={TESTIDS.ask.status} data-offline={offline ? "true" : undefined}>
            {offline ? strings.ask_offline : null}
          </p>
          {thread === null || state === "loading" ? (
            <div className="cx-ask-bones">
              <Skeleton className="cx-ask-bone" style={{ width: "40%" }} />
              <Skeleton className="cx-ask-bone" style={{ width: "80%" }} />
            </div>
          ) : kept.length === 0 ? (
            <EmptyState heading={strings.ask_empty_heading} body={strings.ask_empty_body} data-testid={TESTIDS.ask.empty}>
              <Button variant="secondary" data-testid={TESTIDS.ask.example} disabled={blocked} onClick={() => ask(exampleQuestion)}>
                {exampleQuestion}
              </Button>
            </EmptyState>
          ) : (
            <RevisionContext.Provider value={campaign?.setRevisionId ?? null}>
            <section className="cx-ask-thread" role="feed" aria-label={strings.ask_thread_label} aria-busy={answeringId !== null} data-testid={TESTIDS.ask.thread} onClickCapture={followed}>
              {answeringId === null ? null : <span className="cx-ask-name">{strings.ask_answering}</span>}
              {kept.map((one, index) => (
                <Article
                  key={one.id}
                  kept={one}
                  answering={one.id === answeringId}
                  origin={one.id === origin}
                  links={links(one)}
                  stamp={stamp}
                  blocked={blocked}
                  newest={index === 0}
                  doors={doors}
                />
              ))}
              {kept.length >= THREAD_CAP ? <p className="cx-ask-cap">{strings.ask_thread_cap}</p> : null}
            </section>
            </RevisionContext.Provider>
          )}
        </>
      )}
    </div>
  );
}
