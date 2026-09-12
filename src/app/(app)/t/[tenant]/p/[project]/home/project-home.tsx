"use client";
// S-Project, the project home (R-SPINE-013, R-AI-005), on the v22 foundation: the Dashboard
// template of Design Direction 00 §3.3 with the PROJECT as the subject — a 48 px title row over one
// line of facts, the seven area tabs, four `Stat` tiles, and the recent activity as the one 28 px
// `DataTable`. The screen is a reader: it commits no act, runs no procedure and holds no state, so
// it takes its whole answer as one prop and can be judged over injected data.
//
// I-125 stands: the areas are navigation, so they are links in a `<nav>` and never the Tabs
// primitive — the URL is the source of truth (R-UI-031).
// I-143 (this rebuild) amends I-126 — an area with no screen yet renders DISABLED WITH A TOOLTIP,
// not as inline grey words. "Not available yet" beside four of seven labels was seven labels and
// four sentences in a 32 px row; the condition is the same fact either way, and a tooltip on a
// focusable `aria-disabled` span says it to the pointer and the keyboard both (§8's Home/Project
// fix 2, R-UI-012). The words are still words, never colour (R-UI-060).
// I-144 amends I-127 — the four facts are ONE line under the name, not a four-column `<dl>` block.
// I-145 amends I-128 — the ledger's money is still USD (converting is out of scope by name), but a
// spend of nothing is an absence, not a figure: at zero calls the tile states the readout's absent
// mark and the screen's one helper line says "No model calls yet" (§8).
// I-146 — every SCREAMING enum on this screen renders through `EnumLabel`, and every opaque
// identifier through `IdChip`: an act type is `Assign participant role`, a role is `Principal`, and
// a subject is a copyable chip, never a uuid as body text (§6, §7 C6).
import "./project-home.css";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { dhakaDateParts, formatDate, formatSquareFeet, formatUserFigure } from "@/core/format";
import type { ProjectAiSpend } from "@/modules/ai/spend";
import type { AuditAct } from "@/modules/spine/audit";
import type { Project } from "@/modules/spine/projects";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Badge, EmptyState, EnumLabel, IdChip, RelativeTime, Stat, Tooltip, UnitBadge, type FigureFormat } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { fill, strings } from "@/ui/strings";
import { participantsRoute } from "../settings/participants/route-address";
import { PROJECT_AREAS, QUICK_ACTIONS, RECENT_ACTIVITY_LIMIT, auditRoute } from "./areas";
import { projectHomeStrings as copy } from "./strings";
import { TESTIDS } from "@/ui/testids";

/**
 * The document's conventions, handed to the figure primitives (ARCH-01 keeps the seam out of
 * `src/ui`, so the app hands it down — the frame's own `JobsFormat` precedent). No `money` figure is
 * drawn on this screen: the ledger records USD and converting it is out of scope by name (I-128).
 */
const FIGURES: FigureFormat = {
  figure: (value) => formatUserFigure(value),
  money: (amount) => amount,
  date: (at) => formatDate(dhakaDateParts(at)),
};

/** One zone this project's district falls in, under the book that derives it (C-BK-BOOKS). */
export interface ZoneBadge {
  readonly book: string;
  readonly zone: string;
}

/** One member of the project, named as a reader recognises them, with the roles in force for them. */
export interface ProjectHomeParticipant {
  readonly userId: string;
  readonly label: string;
  readonly roles: readonly string[];
}

/** The roster, or the refusal that stands in its place — the screen's one partial cell (I-129). */
export type ProjectHomeRoster = { readonly roster: readonly ProjectHomeParticipant[] } | { readonly refusal: RefusalCode };

/** Everything the four doors answered about this project, gathered by the page into one answer. */
export interface ProjectHomeData {
  readonly tenantId: string;
  readonly projectId: string;
  readonly project: Project;
  readonly zones: readonly ZoneBadge[];
  readonly participants: ProjectHomeRoster;
  readonly spend: ProjectAiSpend;
  /** Newest first, in the order `getAuditSurfaces` answered — never re-sorted here (I-132). */
  readonly recentActs: readonly AuditAct[];
}

/** The headings the regions are read under, named once so each region's label cannot drift. */
const HEADING_ID = Object.freeze({
  activity: "project-home-activity-heading",
  participants: "project-home-participants-heading",
});

/** The identities the readers' column furniture is remembered under (DataTable, §5 rule 3). */
const TABLE_ID = Object.freeze({ activity: "s-project-activity", roster: "s-project-participants" });

/** A cell with nothing to state says so with the readout's own mark, never with a blank (§3.1). */
function Absent() {
  return <span className="cx-project-absent">{strings.shell_status_absent}</span>;
}

/** A stored fact, or the line that says it is not stated — never a blank cell and never a 0 (I-133). */
function stated(value: string | null) {
  return value === null ? <span className="cx-project-unstated">{copy.project_home_unstated}</span> : value;
}

export function ProjectHome({ data }: { data: ProjectHomeData }) {
  const { tenantId, projectId, project, zones, participants, spend, recentActs } = data;
  const roster = "refusal" in participants ? null : participants.roster;

  return (
    <div className="cx-project" data-testid="project-home" data-project={projectId}>
      <ProjectTitle tenantId={tenantId} projectId={projectId} project={project} zones={zones} />
      <ProjectTabs tenantId={tenantId} projectId={projectId} />

      <div className="cx-project-tiles">
        <Stat value={formatUserFigure(String(project.quickStats.sheets))} label={strings.home_stat_sheets} />
        <Stat value={formatUserFigure(String(project.quickStats.campaigns))} label={strings.home_stat_campaigns} />
        <Stat
          data-testid="project-home-ai-spend"
          label={copy.project_home_ai_heading}
          value={
            spend.calls === 0 ? (
              // I-145: nothing spent is an absence, and the line below says so in words.
              <span data-testid="project-home-ai-cost">
                <Absent />
              </span>
            ) : (
              <span className="cx-project-figure" data-testid="project-home-ai-cost">
                {formatUserFigure(spend.attributedCost)}
                {/* I-134: the shipped badge fixes its own test id, so the contract's id rides a
                    `display: contents` wrapper rather than a second badge drawn to carry it. */}
                <span className="cx-project-unit" data-testid="project-home-ai-cost-unit">
                  <UnitBadge unit={copy.project_home_ai_cost_unit} />
                </span>
              </span>
            )
          }
        />
        <Stat value={roster === null ? <Absent /> : formatUserFigure(String(roster.length))} label={copy.project_home_participants_heading} />
      </div>

      <RecentActivity tenantId={tenantId} projectId={projectId} acts={recentActs} />
      <Participants tenantId={tenantId} projectId={projectId} participants={participants} />

      {/* The screen's ONE line of helper copy, at the foot: the model calls behind the tile above,
          what came of them, and the ledger that is the evidence for both. It stands last because
          the fold belongs to the work surface — a sentence between the tiles and the table pushes
          the table down by its own height, and this is a readout, not a heading (§7 C2, C7). */}
      <AiLine tenantId={tenantId} projectId={projectId} spend={spend} />
    </div>
  );
}

/* -------------------------------------------------------------------------------- the title */

/**
 * I-144: the name and the one primary on a 48 px row, and under it ONE line of facts — client,
 * district, the zones its district derives, the target GFA in both units. A `<dl>` still, because
 * they are labelled cells and not prose, but laid out as the line a title block draws.
 */
function ProjectTitle({ tenantId, projectId, project, zones }: { tenantId: string; projectId: string; project: Project; zones: readonly ZoneBadge[] }) {
  const [primary] = QUICK_ACTIONS;

  return (
    <header className="cx-project-title" data-testid="project-home-header">
      <div className="cx-project-title-row">
        <h1 className="cx-project-name" data-testid="project-home-name">
          {project.name}
        </h1>
        {/* A project that has been put away says so where it is named — the flag S-Home's own row
            carries for this fact, worn by the same shipped Badge and read by the same key (B-17).
            An active project wears nothing: a status stated on every project states nothing. */}
        {project.status === "archived" ? <Badge>{strings.home_status_archived}</Badge> : null}

        {/* The screen's three doors, in the title row where §3.3 puts the primary. ONE of them is
            primary — "if it is indigo you can act on it" — and the other two are the shipped
            secondary Button worn as a link (the `sheet-card-open` precedent, B-17). The heading
            that used to name a "Quick actions" section is gone with the section: a row of doors in
            the title row needs no label to say that it is one (§7 C7). */}
        <div className="cx-project-title-controls" data-testid="project-quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.key}
              className="cx-btn cx-reticle"
              data-variant={action === primary ? "primary" : "secondary"}
              data-testid="project-quick-action"
              data-action={action.key}
              href={action.route(tenantId, projectId)}
            >
              {copy[action.label]}
            </Link>
          ))}
        </div>
      </div>

      <dl className="cx-project-facts">
        <div className="cx-project-fact">
          <dt>{copy.project_home_client_label}</dt>
          <dd data-testid={TESTIDS.project.homeClient}>{stated(project.client)}</dd>
        </div>

        <div className="cx-project-fact">
          <dt>{copy.project_home_district_label}</dt>
          <dd data-testid={TESTIDS.project.homeDistrict}>{stated(project.district)}</dd>
        </div>

        {/* I-133: a zone roster with no book pinned says why it is empty rather than standing
            silent, and the count is the badges themselves — never a number of its own. */}
        <div className="cx-project-fact">
          <dt>{copy.project_home_zones_label}</dt>
          <dd className="cx-project-zones" data-testid={TESTIDS.project.homeZones} data-count={zones.length}>
            {zones.length === 0 ? (
              <span className="cx-project-unstated">{copy.project_home_zones_none}</span>
            ) : (
              zones.map((zone) => (
                <Badge
                  key={`${zone.book}/${zone.zone}`}
                  className="cx-project-zone"
                  data-testid={TESTIDS.project.homeZoneBadge}
                  data-book={zone.book}
                  data-zone={zone.zone}
                  aria-label={fill(copy.project_home_zone_label, { zone: zone.zone, book: zone.book })}
                >
                  {zone.zone}
                </Badge>
              ))
            )}
          </dd>
        </div>

        <div className="cx-project-fact">
          <dt>{copy.project_home_gfa_label}</dt>
          <dd className="cx-project-gfa">
            {project.targetGfaM2 === null ? (
              <span className="cx-project-unstated" data-testid={TESTIDS.project.homeGfa}>
                {copy.project_home_unstated}
              </span>
            ) : (
              // A target stated once, in the two units it is read in: the m² figure the store holds
              // and the seam's own conversion of it. The factor is the seam's (L-FMT-02).
              <>
                <span className="cx-project-figure" data-testid="project-home-gfa">
                  {formatUserFigure(project.targetGfaM2)}
                  <UnitBadge unit={copy.project_home_unit_m2} />
                </span>
                <span className="cx-project-figure cx-project-figure-converted" data-testid="project-home-gfa-sft">
                  {formatSquareFeet(project.targetGfaM2)}
                  <UnitBadge unit={copy.project_home_unit_sft} />
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>
    </header>
  );
}

/* -------------------------------------------------------------------- the navigation regions */

/**
 * I-125: a row of links over one hairline, marking nothing current — the screen the reader is on is
 * the home above the row, not one of the seven. Availability is read off the roster's own address
 * (I-126), so an area's tab becomes a link the day its screen lands and by nothing else. I-143: the
 * four that have no screen are disabled controls with a tooltip, not labels with a sentence.
 */
function ProjectTabs({ tenantId, projectId }: { tenantId: string; projectId: string }) {
  return (
    <nav className="cx-project-tabs" data-testid={TESTIDS.project.tabs} aria-label={copy.project_home_tabs_label}>
      {PROJECT_AREAS.map((area) =>
        area.route === null ? (
          <Tooltip key={area.key} content={copy.project_home_tab_unavailable}>
            {/* Focusable on purpose: a condition only a pointer can read is a condition half the
                readers never learn (R-UI-012). `aria-disabled`, never `disabled`. */}
            <span className="cx-project-tab" data-testid="project-tab" data-area={area.key} data-available="false" role="link" aria-disabled="true" tabIndex={0}>
              {copy[area.label]}
            </span>
          </Tooltip>
        ) : (
          <Link
            key={area.key}
            className="cx-project-tab cx-reticle"
            data-testid={TESTIDS.project.tab}
            data-area={area.key}
            data-available="true"
            href={area.route(tenantId, projectId)}
          >
            {copy[area.label]}
          </Link>
        ),
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------------ AI cost so far */

/**
 * R-AI-005 on the project home, in the screen's ONE line of helper copy (§7 C7): how many calls,
 * what came of them, and the ledger that is the evidence for both. The figure itself is the tile
 * above; at zero calls this line is the honest sentence that explains the absent mark (I-145).
 */
function AiLine({ tenantId, projectId, spend }: { tenantId: string; projectId: string; spend: ProjectAiSpend }) {
  return (
    <p className="cx-project-line">
      {spend.calls === 0 ? (
        <span data-testid="project-home-ai-none">{copy.project_home_ai_none}</span>
      ) : (
        <>
          <span className="cx-project-figure" data-testid="project-home-ai-calls">
            {formatUserFigure(String(spend.calls))}
          </span>{" "}
          {copy.project_home_ai_calls_caption}
          <span className="cx-project-pause">, </span>
          <span aria-hidden="true"> · </span>
          <span data-testid="project-home-ai-outcomes">
            {fill(copy.project_home_ai_outcomes, {
              proposed: formatUserFigure(String(spend.proposed)),
              refused: formatUserFigure(String(spend.refused)),
            })}
          </span>
        </>
      )}
      <span className="cx-project-pause">, </span>
      <span aria-hidden="true"> · </span>
      <Link className="cx-project-evidence cx-reticle" data-testid="project-home-ai-ledger" href={auditRoute(tenantId, projectId)}>
        {copy.project_home_ai_ledger}
      </Link>
    </p>
  );
}

/* ------------------------------------------------------------------------- recent activity */

/**
 * The newest acts as the one 28 px table (§3.3): what was done, by whom, when, and to what. The cap
 * is the screen's own number (I-132) and the order is the audit door's, never re-sorted here.
 */
function RecentActivity({ tenantId, projectId, acts }: { tenantId: string; projectId: string; acts: readonly AuditAct[] }) {
  const shown = acts.slice(0, RECENT_ACTIVITY_LIMIT);

  const columns: ColumnDef<AuditAct, unknown>[] = [
    {
      id: "act",
      header: copy.project_home_col_act,
      size: 230,
      // I-146: the act type is a closed enum, so a reader gets the words and the DOM keeps the
      // value — the SCREAMING form lives in the technical disclosure, not on the page (§6).
      cell: ({ row }) => <EnumLabel value={row.original.actType} />,
    },
    {
      id: "who",
      header: copy.project_home_col_who,
      size: 220,
      cell: ({ row }) => <span className="cx-project-member-label">{row.original.actorLabel}</span>,
    },
    {
      id: "when",
      header: copy.project_home_col_when,
      size: 130,
      cell: ({ row }) => <RelativeTime className="cx-project-activity-when" at={new Date(row.original.occurredAt)} format={FIGURES} />,
    },
    {
      id: "subject",
      header: copy.project_home_col_subject,
      size: 170,
      // An act's subject is an opaque key: short on screen, whole in the DOM, one press from the
      // clipboard (R-UI-082) — never a uuid as body text.
      cell: ({ row }) => (
        <span className="cx-project-subjects">
          {row.original.subjects.map((subject) => (
            <IdChip key={subject} value={subject} />
          ))}
        </span>
      ),
    },
  ];

  return (
    <section className="cx-project-region" aria-labelledby={HEADING_ID.activity}>
      <div className="cx-project-region-head">
        <h2 className="cx-project-region-heading" id={HEADING_ID.activity}>
          {copy.project_home_activity_heading}
        </h2>
        <Link className="cx-project-evidence cx-reticle" data-testid="project-home-activity-all" href={auditRoute(tenantId, projectId)}>
          {copy.project_home_activity_all}
        </Link>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          data-testid="project-home-activity-empty"
          heading={strings.state_empty_project_home_heading}
          body={copy.project_home_activity_empty}
        />
      ) : (
        <div className="cx-project-table" data-testid="project-home-activity">
          <DataTable
            tableId={TABLE_ID.activity}
            aria-labelledby={HEADING_ID.activity}
            columns={columns}
            data={[...shown]}
            getRowId={(act) => act.actId}
            rowTestId="project-home-activity-row"
            rowDataOf={(act) => ({ "data-act-type": act.actType })}
          />
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------------------- participants */

/**
 * Who holds this project, and under which roles — the same 28 px table, two columns. I-129: a
 * member without standing is refused here and only here; the refusal takes the roster's own place,
 * through the one renderer and with the evidence link to the setting that resolves it (R-UI-020),
 * and nothing else on the page is withheld.
 */
function Participants({ tenantId, projectId, participants }: { tenantId: string; projectId: string; participants: ProjectHomeRoster }) {
  const columns: ColumnDef<ProjectHomeParticipant, unknown>[] = [
    {
      id: "member",
      header: strings.spine_participants_field_member,
      size: 320,
      cell: ({ row }) => <span className="cx-project-member-label">{row.original.label}</span>,
    },
    {
      id: "roles",
      header: strings.spine_participants_field_role,
      size: 220,
      // I-146 amends I-47 for this screen: a role is read in words and kept as a value.
      cell: ({ row }) => (
        <span className="cx-project-roles">
          {row.original.roles.map((role) => (
            <EnumLabel key={role} value={role} data-testid="project-home-participant-role" className="cx-project-role" />
          ))}
        </span>
      ),
    },
  ];

  return (
    <section className="cx-project-region" aria-labelledby={HEADING_ID.participants}>
      <div className="cx-project-region-head">
        <h2 className="cx-project-region-heading" id={HEADING_ID.participants}>
          {copy.project_home_participants_heading}
        </h2>
      </div>

      <div className="cx-project-table" data-testid="project-home-participants">
        {"refusal" in participants ? (
          <RefusalState
            refusal={refusalOf(participants.refusal)}
            evidence={{ href: participantsRoute(tenantId, projectId), label: copy.project_home_evidence_participants }}
          />
        ) : (
          <DataTable
            tableId={TABLE_ID.roster}
            aria-labelledby={HEADING_ID.participants}
            columns={columns}
            data={[...participants.roster]}
            getRowId={(member) => member.userId}
            rowTestId="project-home-participant"
            rowDataOf={(member) => ({ "data-user": member.userId })}
          />
        )}
      </div>
    </section>
  );
}
