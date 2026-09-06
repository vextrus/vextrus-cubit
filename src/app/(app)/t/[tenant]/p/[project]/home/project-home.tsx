"use client";
// S-Project, the project home (R-SPINE-013, R-AI-005): six regions, every one of them a statement
// about the project the address names. The screen is a reader — it commits no act, runs no procedure
// and holds no state, so it takes its whole answer as one prop and can be judged over injected data.
//
// I-125/I-126: the areas are navigation, so they are links over a hairline and never the Tabs
// primitive, and an area with no screen yet is a non-control that states its condition in words.
// I-128: the ledger's money is a figure and a unit, never `formatMoney` — no ৳ appears here.
// I-129: only the roster can refuse, and it refuses in its own place while the other five answer.
import "./project-home.css";

import Link from "next/link";
import { refusalOf, type RefusalCode } from "../../../../../../../core/errors";
import { dhakaDateParts, formatDate, formatSquareFeet, formatUserFigure } from "../../../../../../../core/format";
import type { ProjectAiSpend } from "../../../../../../../modules/ai/spend";
import type { AuditAct } from "../../../../../../../modules/spine/audit";
import type { Project } from "../../../../../../../modules/spine/projects";
import { RefusalState } from "../../../../../../../ui/patterns/refusal-state";
import { Badge, UnitBadge } from "../../../../../../../ui/primitives/core";
import { fill, strings } from "../../../../../../../ui/strings";
import { participantsRoute } from "../settings/participants/route-address";
import { PROJECT_AREAS, QUICK_ACTIONS, RECENT_ACTIVITY_LIMIT, auditRoute } from "./areas";
import { projectHomeStrings as copy } from "./strings";

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
  actions: "project-home-actions-heading",
  ai: "project-home-ai-heading",
  activity: "project-home-activity-heading",
  participants: "project-home-participants-heading",
});

export function ProjectHome({ data }: { data: ProjectHomeData }) {
  const { tenantId, projectId, project, zones, participants, spend, recentActs } = data;

  return (
    <div className="cx-project" data-testid="project-home" data-project={projectId}>
      <ProjectHeader project={project} zones={zones} />
      <ProjectTabs tenantId={tenantId} projectId={projectId} />
      <QuickActions tenantId={tenantId} projectId={projectId} />

      <div className="cx-project-body">
        <div className="cx-project-column">
          <AiSpend tenantId={tenantId} projectId={projectId} spend={spend} />
          <RecentActivity tenantId={tenantId} projectId={projectId} acts={recentActs} />
        </div>
        <Participants tenantId={tenantId} projectId={projectId} participants={participants} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------- the header */

/**
 * I-127: the heading is the project itself, and the four facts under it are a `<dl>` — a title block
 * is the idiom of the people who read drawings. Only what S-Project names renders here.
 */
function ProjectHeader({ project, zones }: { project: Project; zones: readonly ZoneBadge[] }) {
  return (
    <header className="cx-project-header" data-testid="project-home-header">
      <h1 className="cx-project-name" data-testid="project-home-name">
        {project.name}
      </h1>

      <dl className="cx-project-facts">
        <div className="cx-project-fact">
          <dt>{copy.project_home_client_label}</dt>
          <dd data-testid="project-home-client">{stated(project.client)}</dd>
        </div>

        <div className="cx-project-fact">
          <dt>{copy.project_home_district_label}</dt>
          <dd data-testid="project-home-district">{stated(project.district)}</dd>
        </div>

        {/* I-133: a zone roster with no book pinned says why it is empty rather than standing
            silent, and the count is the badges themselves — never a number of its own. */}
        <div className="cx-project-fact">
          <dt>{copy.project_home_zones_label}</dt>
          <dd className="cx-project-zones" data-testid="project-home-zones" data-count={zones.length}>
            {zones.length === 0 ? (
              <span className="cx-project-unstated">{copy.project_home_zones_none}</span>
            ) : (
              zones.map((zone) => (
                <Badge
                  key={`${zone.book}/${zone.zone}`}
                  className="cx-project-zone"
                  data-testid="project-home-zone-badge"
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
              <span className="cx-project-unstated" data-testid="project-home-gfa">
                {copy.project_home_unstated}
              </span>
            ) : (
              // A target stated once, in the two units it is read in: the m² figure the store holds
              // and the seam's own conversion of it. The factor is the seam's (L-FMT-02).
              <>
                <span className="cx-project-figure-line" data-testid="project-home-gfa">
                  {formatUserFigure(project.targetGfaM2)}
                  <UnitBadge unit={copy.project_home_unit_m2} />
                </span>
                <span className="cx-project-figure-line cx-project-figure-converted" data-testid="project-home-gfa-sft">
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

/** A stored fact, or the line that says it is not stated — never a blank cell and never a 0 (I-133). */
function stated(value: string | null) {
  return value === null ? <span className="cx-project-unstated">{copy.project_home_unstated}</span> : value;
}

/* -------------------------------------------------------------------- the navigation regions */

/**
 * I-125: a row of links over one hairline, marking nothing current — the screen the reader is on is
 * the home above the row, not one of the seven. Availability is read off the roster's own address
 * (I-126), so an area's tab becomes a link the day its screen lands and by nothing else.
 */
function ProjectTabs({ tenantId, projectId }: { tenantId: string; projectId: string }) {
  return (
    <nav className="cx-project-tabs" data-testid="project-tabs" aria-label={copy.project_home_tabs_label}>
      {PROJECT_AREAS.map((area) =>
        area.route === null ? (
          <span key={area.key} className="cx-project-tab" data-testid="project-tab" data-area={area.key} data-available="false" aria-disabled="true">
            {copy[area.label]}{" "}
            <span className="cx-project-tab-condition">{copy.project_home_tab_unavailable}</span>
          </span>
        ) : (
          <Link
            key={area.key}
            className="cx-project-tab cx-reticle"
            data-testid="project-tab"
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

/** The three doors a reader most often comes here for, worn as the core secondary button (B-17). */
function QuickActions({ tenantId, projectId }: { tenantId: string; projectId: string }) {
  return (
    <section className="cx-project-actions" data-testid="project-quick-actions" aria-labelledby={HEADING_ID.actions}>
      <h2 className="cx-project-region-heading" id={HEADING_ID.actions}>
        {copy.project_home_actions_heading}
      </h2>
      <div className="cx-project-action-row">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.key}
            className="cx-btn cx-reticle cx-project-action"
            data-variant="secondary"
            data-testid="project-quick-action"
            data-action={action.key}
            href={action.route(tenantId, projectId)}
          >
            {copy[action.label]}
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ AI cost so far */

/**
 * R-AI-005 on the project home: what has been spent, how many calls it took and what came of them.
 * I-128 — the ledger records an exact USD decimal, so it renders as a figure beside a unit badge.
 * A project no model has been called for states its zeros and says why they are zeros (R-UI-020).
 */
function AiSpend({ tenantId, projectId, spend }: { tenantId: string; projectId: string; spend: ProjectAiSpend }) {
  return (
    <section className="cx-project-card" data-testid="project-home-ai-spend" aria-labelledby={HEADING_ID.ai}>
      <h2 className="cx-project-region-heading" id={HEADING_ID.ai}>
        {copy.project_home_ai_heading}
      </h2>

      <div className="cx-project-figures">
        <div className="cx-project-figure">
          <p className="cx-project-figure-value" data-testid="project-home-ai-cost">
            {formatUserFigure(spend.attributedCost)}
            {/* I-134: the shipped badge fixes its own test id, so the contract's id rides a
                `display: contents` wrapper rather than a second badge drawn to carry it (B-17). */}
            <span className="cx-project-unit" data-testid="project-home-ai-cost-unit">
              <UnitBadge unit={copy.project_home_ai_cost_unit} />
            </span>
          </p>
          <p className="cx-project-figure-caption">{copy.project_home_ai_cost_caption}</p>
        </div>

        <div className="cx-project-figure">
          <p className="cx-project-figure-value" data-testid="project-home-ai-calls">
            {formatUserFigure(String(spend.calls))}
          </p>
          <p className="cx-project-figure-caption">{copy.project_home_ai_calls_caption}</p>
        </div>
      </div>

      <p className="cx-project-count-line" data-testid="project-home-ai-outcomes">
        {fill(copy.project_home_ai_outcomes, {
          proposed: formatUserFigure(String(spend.proposed)),
          refused: formatUserFigure(String(spend.refused)),
        })}
      </p>

      {spend.calls === 0 ? (
        <p className="cx-project-region-note" data-testid="project-home-ai-none">
          {copy.project_home_ai_none}
        </p>
      ) : null}

      <Link className="cx-project-evidence cx-reticle" data-testid="project-home-ai-ledger" href={auditRoute(tenantId, projectId)}>
        {copy.project_home_ai_ledger}
      </Link>
    </section>
  );
}

/* ------------------------------------------------------------------------- recent activity */

/**
 * The newest acts, in the order the audit door answered them and capped at the screen's one number
 * (I-132). Dates are absolute through the format seam — no relative time, nothing that ticks.
 */
function RecentActivity({ tenantId, projectId, acts }: { tenantId: string; projectId: string; acts: readonly AuditAct[] }) {
  const shown = acts.slice(0, RECENT_ACTIVITY_LIMIT);

  return (
    <section className="cx-project-card" aria-labelledby={HEADING_ID.activity}>
      <h2 className="cx-project-region-heading" id={HEADING_ID.activity}>
        {copy.project_home_activity_heading}
      </h2>
      <p className="cx-project-region-hint">{copy.project_home_activity_hint}</p>

      {shown.length === 0 ? (
        <p className="cx-project-region-note" data-testid="project-home-activity-empty">
          {copy.project_home_activity_empty}
        </p>
      ) : (
        <ol className="cx-project-rows" data-testid="project-home-activity">
          {shown.map((act) => (
            <li className="cx-project-row" key={act.actId} data-testid="project-home-activity-row" data-act-type={act.actType}>
              {/* An act type is a machine identifier and renders verbatim as data (I-25's class). */}
              <span className="cx-project-act-type">{act.actType}</span>
              <span className="cx-project-act-actor">{act.actorLabel}</span>
              <span className="cx-project-activity-when">{formatDate(dhakaDateParts(act.occurredAt))}</span>
            </li>
          ))}
        </ol>
      )}

      <Link className="cx-project-evidence cx-reticle" data-testid="project-home-activity-all" href={auditRoute(tenantId, projectId)}>
        {copy.project_home_activity_all}
      </Link>
    </section>
  );
}

/* ----------------------------------------------------------------------------- participants */

/**
 * Who holds this project, and under which roles. I-129: a member without standing is refused here
 * and only here — the refusal takes the roster's own place, through the one renderer and with the
 * evidence link to the setting that resolves it (R-UI-020), and nothing else on the page is withheld.
 */
function Participants({ tenantId, projectId, participants }: { tenantId: string; projectId: string; participants: ProjectHomeRoster }) {
  return (
    <section className="cx-project-card" aria-labelledby={HEADING_ID.participants}>
      <h2 className="cx-project-region-heading" id={HEADING_ID.participants}>
        {copy.project_home_participants_heading}
      </h2>
      <p className="cx-project-region-hint">{copy.project_home_participants_hint}</p>

      {"refusal" in participants ? (
        <div className="cx-project-denied" data-testid="project-home-participants">
          <p className="cx-project-denied-line">{strings.spine_participants_denied_permission}</p>
          <p className="cx-project-denied-line">{strings.spine_participants_denied_holder}</p>
          <RefusalState
            refusal={refusalOf(participants.refusal)}
            evidence={{ href: participantsRoute(tenantId, projectId), label: copy.project_home_evidence_participants }}
          />
        </div>
      ) : (
        <ul className="cx-project-rows" data-testid="project-home-participants">
          {participants.roster.map((member) => (
            <li className="cx-project-row cx-project-member" key={member.userId} data-testid="project-home-participant" data-user={member.userId}>
              <span className="cx-project-member-label">{member.label}</span>
              <span className="cx-project-member-roles">
                {/* A role name is L-ACT-03's own enum value and renders verbatim (I-47). */}
                {member.roles.map((role) => (
                  <span className="cx-project-role" key={role} data-testid="project-home-participant-role" data-role={role}>
                    {role}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
