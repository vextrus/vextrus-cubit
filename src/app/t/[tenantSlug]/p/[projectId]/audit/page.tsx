/**
 * `/t/{tenantSlug}/p/{projectId}/audit` — the act log explorer (R-SPINE-081, L-ACT-01, S-Audit;
 * docs/design/s-audit.md §3).
 *
 * A read-only pane, server-rendered whole: the project's acts newest first, each with the two
 * things the Bible asks an entry to show — its consequence (the `participant_roles` row the same
 * transaction wrote, joined on `act_id`) and its cited evidence, which in M0 is an absence the
 * screen teaches rather than a blank cell (§3, R-UI-020).
 *
 * Nothing here writes and nothing here mints a refusal (Interpretation 1): reading the log is
 * tenant membership, and a project this workspace cannot see 404s exactly as every other pane of
 * the segment does. The filters are the URL (Interpretation 3) — a GET form of native selects,
 * so the closed sets are in the document the server sends and every filtered read is also a deep
 * link.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import './audit.css';
import { around, ten } from '../../../../strings';
import { ACT_TYPE } from '../../../../../../core/acts';
import { dhakaDateParts, formatDate } from '../../../../../../core/format';
import { actLog } from '../../../../../../modules/spine/audit';
import type { ActLogEntry } from '../../../../../../modules/spine/audit';
import {
  participantRoster,
  projectContext,
  readProject,
} from '../../../../../../modules/spine/projects';
import { SIGN_IN_PATH, tenantContext } from '../../../../../../server/session';

/** The lead names the project itself, the ruleset pane's way (§3). */
const NAME_SLOT = '{name}';

/** The consequence sentence names the grantee in its first half (Interpretation 9). */
const MEMBER_SLOT = '{member}';

/** The URL is the whole filter state (Interpretation 3): three params, named once. */
const TYPE = 'type';
const ACTOR = 'actor';
const SUBJECT = 'subject';

/** The form is a read, so it asks its question in the address bar (§3). */
const GET = 'get';
const SUBMIT = 'submit';

/**
 * The two derived slots of an entry, by the ids the contract fixes (§11).
 *
 * Written here rather than in the JSX because a test id is the one string a component may carry
 * that is not copy, and the rule that keeps copy out of JSX reads an attribute it does not know
 * as copy — `data-testid` on a host element is exempt, a `testId` prop is not.
 */
const CONSEQUENCE_ID = 'act-consequence';
const EVIDENCE_ID = 'act-evidence';

/**
 * Interpretation 5: an entry's time is the seam's date plus the same instant's Dhaka
 * wall-clock `HH:mm`.
 *
 * The date goes through SEAM-FORMAT. The time of day the seam does not format, and L-FMT-01
 * makes `src/core/format.ts` the tree's only `Intl` caller, so the wall clock is read here from
 * the zone's own offset rather than from the process's ambient one — Asia/Dhaka has stood at
 * UTC+06:00 with no daylight rule since 2010, which is the offset the seam's own formatter
 * resolves for every instant this log can hold. Ambient-zone arithmetic (`getHours`) is what
 * the design forbids, and none is done: the reading is of UTC plus the document's offset.
 */
const DHAKA_OFFSET_MINUTES = 360;
const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const CLOCK_DIGITS = 2;
const ZERO = '0';

function dhakaWallClock(epochMs: number): string {
  const minutes = Math.floor(epochMs / MS_PER_MINUTE) + DHAKA_OFFSET_MINUTES;
  const ofDay = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(ofDay / MINUTES_PER_HOUR);
  const minute = ofDay - hour * MINUTES_PER_HOUR;
  return `${String(hour).padStart(CLOCK_DIGITS, ZERO)}:${String(minute).padStart(CLOCK_DIGITS, ZERO)}`;
}

/** The instant an entry carries, as the document writes it: `24 Aug 2026 14:05`. */
function stamp(at: string): string {
  const epochMs = Date.parse(at);
  if (!Number.isFinite(epochMs)) return at;
  return `${formatDate(dhakaDateParts(epochMs))} ${dhakaWallClock(epochMs)}`;
}

/** A search param a reader may have written twice, or not at all. */
function one(value: string | readonly string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

/**
 * What a select shows: the param, when it names an option, and otherwise the "all" option.
 *
 * A hand-edited URL filters honestly (Interpretation 3) — the log answers no rows — and the
 * control, finding nothing of its own to point at, says it is offering everything rather than
 * inventing an option that is not in the closed set.
 */
function chosen(value: string, offered: readonly string[]): string {
  return offered.includes(value) ? value : '';
}

interface FilterProps {
  readonly id: string;
  readonly name: string;
  /** Already read from the table by the caller — the strings arrive here, never their keys. */
  readonly label: string;
  readonly all: string;
  readonly options: readonly string[];
  readonly value: string;
  readonly mono?: boolean;
}

/** §3: one filter — a native select on the Datum control surface, its label above it. */
function Filter({ id, name, label, all, options, value, mono = false }: FilterProps) {
  return (
    <div className="project-audit-filter">
      <label className="project-form-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        data-testid={id}
        name={name}
        className={
          mono
            ? 'datum-control datum-select-trigger datum-focus-ring project-audit-filter-type'
            : 'datum-control datum-select-trigger datum-focus-ring'
        }
        defaultValue={chosen(value, options)}
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/** §3: one definition row of an entry — a label beside the value it names. */
function EntryRow({
  label,
  testId,
  quiet = false,
  children,
}: {
  readonly label: string;
  readonly testId?: string;
  readonly quiet?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className="project-audit-row">
      <dt className="project-audit-row-label">{label}</dt>{' '}
      <dd
        className={
          quiet ? 'project-audit-row-value project-audit-evidence' : 'project-audit-row-value'
        }
        data-testid={testId}
      >
        {children}
      </dd>{' '}
    </div>
  );
}

/** §3: one act, as a reader reads it — the headline, the two people, the consequence, the cite. */
function Entry({ entry }: { readonly entry: ActLogEntry }) {
  const [said, ended] = around('project.audit.entry.setRole', 'role');
  return (
    <li className="project-audit-entry" data-testid="act-log-entry" data-act-type={entry.actType}>
      {/* The two spaces are text, not layout: an entry read aloud — or read by a journey — is
          one run of characters, and a headline that ran into its own timestamp would say
          `ASSIGN_PARTICIPANT_ROLE24 Aug 2026`. A whitespace-only anonymous flex item is not
          rendered (CSS flexbox §4), so the row is laid out exactly as it was without them. */}
      <div className="project-audit-entry-head">
        <span className="project-audit-act-type">{entry.actType}</span>{' '}
        <time className="project-audit-when numeric" dateTime={entry.at}>
          {stamp(entry.at)}
        </time>{' '}
      </div>
      <dl className="project-audit-rows">
        <EntryRow label={ten('project.audit.filter.actor')}>{entry.actorEmail}</EntryRow>
        <EntryRow label={ten('project.audit.filter.subject')}>{entry.subjectEmail}</EntryRow>
        <EntryRow label={ten('project.audit.entry.consequence')} testId={CONSEQUENCE_ID}>
          {said.split(MEMBER_SLOT).join(entry.subjectEmail)}
          <span className="project-audit-role">{entry.role}</span>
          {ended}
        </EntryRow>
        <EntryRow label={ten('project.audit.entry.evidence')} testId={EVIDENCE_ID} quiet>
          {ten('project.audit.entry.evidenceNone')}
        </EntryRow>
      </dl>
    </li>
  );
}

/** §3: what a filter that matched nothing says — never an error, and never a bare blank. */
function FilteredEmpty({ href }: { readonly href: string }) {
  return (
    <div className="datum-state-block" data-testid="act-log-empty">
      <p className="datum-state-title">{ten('project.audit.acts.empty.title')}</p>
      <p className="datum-state-body">{ten('project.audit.acts.empty.teach')}</p>
      <div className="datum-state-actions">
        <Link className="project-audit-clear datum-focus-ring" href={href}>
          {ten('project.audit.acts.empty.clear')}
        </Link>
      </div>
    </div>
  );
}

export default async function ProjectAuditActsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug, projectId } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const ctx = projectContext({ tenantId: context.tenantId, userId: context.session.userId });
  const project = await readProject(ctx, { projectId });
  if (project === null) notFound();

  const asked = await searchParams;
  const type = one(asked[TYPE]);
  const actor = one(asked[ACTOR]);
  const subject = one(asked[SUBJECT]);

  const [roster, entries] = await Promise.all([
    participantRoster(ctx, { projectId: project.id }),
    actLog(ctx, { projectId: project.id, type, actor, subject }),
  ]);

  // Interpretation 4: both people-filters offer the roster, in roster order.
  const people = roster.map((participant) => participant.email);
  // Interpretation 8: the act types are the seam's own names, never a literal written here.
  const actTypes = Object.values(ACT_TYPE);
  const route = `/t/${context.slug}/p/${project.id}/audit`;

  const [opening, closing] = around('project.audit.acts.lead', 'code');
  return (
    <div>
      <h1 className="tenant-title">{ten('project.audit.nav.acts')}</h1>
      <p className="tenant-lead">
        {opening.split(NAME_SLOT).join(project.name)}
        <span className="project-audit-role">{project.code}</span>
        {closing}
      </p>

      {/* §3: the filter row. A GET form, so applying a filter is a navigation and the address
          it lands on is the whole of what the reader asked for. */}
      <form className="project-audit-filters" action={route} method={GET}>
        <Filter
          id="act-filter-type"
          name={TYPE}
          label={ten('project.audit.filter.type')}
          all={ten('project.audit.filter.anyType')}
          options={actTypes}
          value={type}
          mono
        />
        <Filter
          id="act-filter-actor"
          name={ACTOR}
          label={ten('project.audit.filter.actor')}
          all={ten('project.audit.filter.anyActor')}
          options={people}
          value={actor}
        />
        <Filter
          id="act-filter-subject"
          name={SUBJECT}
          label={ten('project.audit.filter.subject')}
          all={ten('project.audit.filter.anySubject')}
          options={people}
          value={subject}
        />
        <button
          className="datum-control datum-button datum-focus-ring"
          data-testid="act-filter-apply"
          data-variant="secondary"
          type={SUBMIT}
        >
          {ten('project.audit.filter.apply')}
        </button>
      </form>

      {/* §3 and Interpretation 7: the log is a labelled tab stop, so a keyboard reader can
          reach and scroll it — the pane carries no control of its own to land on. */}
      <section
        aria-label={ten('project.audit.nav.acts')}
        className="project-audit-log datum-focus-ring"
        data-testid="act-log"
        tabIndex={0}
      >
        {entries.length === 0 ? (
          <FilteredEmpty href={route} />
        ) : (
          <ol className="project-audit-entries">
            {entries.map((entry) => (
              // One act with several subjects (a confirm-all, L-ACT-01) is several entries of
              // the same act id, so the key names the pair the row actually is.
              <Entry entry={entry} key={`${entry.actId}:${entry.subjectId}`} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
