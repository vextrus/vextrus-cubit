"use client";
// One project on S-Home: what it is called, where it stands, what it has produced so far, and the
// three doors R-SPINE-010 gives it. I-32 — the card is not a door: no route for a project's own home
// exists yet, so the name is text, and the card's only navigation is the pin link L-REG-07 makes
// visible. I-35 — archive is reversible, so it and restore are plain ghost doors that answer in
// place: neither is destructive, and neither is an act.
import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import { refusalOf, type RefusalCode } from "../../../../../core/errors";
import { formatDate } from "../../../../../core/format";
import type { BuildingType } from "../../../../../core/projects";
import type { Project } from "../../../../../modules/spine/projects";
import { RefusalState } from "../../../../../ui/patterns/refusal-state";
import { Badge, Button } from "../../../../../ui/primitives/core";
import { shellHref, useFailureHandOff } from "../../../../../ui/shell";
import { fill, strings, type StringKey } from "../../../../../ui/strings";
import { archiveProjectAction, restoreProjectAction, type LifecycleAnswer } from "../actions";

/** I-33's labels, read here for the meta line: the enum is stored, the prose is shown. */
const BUILDING_TYPE_LABEL: Readonly<Record<BuildingType, StringKey>> = {
  residential: "home_building_type_residential",
  commercial: "home_building_type_commercial",
  mixed: "home_building_type_mixed",
  industrial: "home_building_type_industrial",
  infrastructure: "home_building_type_infrastructure",
};

/** I-36: the four counts, each with the label it is read under. */
const QUICK_STATS: readonly { readonly testId: string; readonly label: StringKey; readonly of: (project: Project) => number }[] = [
  { testId: "s-home-stat-sheets", label: "home_stat_sheets", of: (project) => project.quickStats.sheets },
  { testId: "s-home-stat-campaigns", label: "home_stat_campaigns", of: (project) => project.quickStats.campaigns },
  { testId: "s-home-stat-estimates", label: "home_stat_estimates", of: (project) => project.quickStats.estimates },
  { testId: "s-home-stat-bids", label: "home_stat_bids", of: (project) => project.quickStats.bids },
];

export interface ProjectCardProps {
  tenantId: string;
  project: Project;
  /** Opens the shared form on this project — the card holds no form of its own. */
  onEdit: (project: Project) => void;
  /** What a lifecycle door answered, held by the grid so one refusal stands at a time. */
  refusal: RefusalCode | null;
  onAnswer: (projectId: string, answer: LifecycleAnswer) => void;
}

export function ProjectCard({ tenantId, project, onEdit, refusal, onAnswer }: ProjectCardProps) {
  const [pending, start] = useTransition();
  // A failed door is a failure, not a silence: closing over a discarded promise would leave the
  // button simply stopping being busy with nothing said (ARCH-03, B-21).
  const handing = useFailureHandOff();
  const archived = project.status === "archived";

  const move = (door: (tenantId: string, projectId: string) => Promise<LifecycleAnswer>): void => {
    if (pending) return;
    start(() => handing(async () => onAnswer(project.projectId, await door(tenantId, project.projectId))));
  };

  return (
    <li className="cx-home-card" data-testid="s-home-project-card" data-project={project.projectId} data-archived={archived ? "true" : "false"}>
      <div className="cx-home-card-name-row">
        <p className="cx-home-card-name">{project.name}</p>
        {project.code === null ? null : <span className="cx-home-card-code">{project.code}</span>}
        {/* The scan-level flag, its meaning carried by the word and never by colour alone (Q-11). */}
        {archived ? <Badge data-testid="s-home-project-archived-badge">{strings.home_status_archived}</Badge> : null}
      </div>

      <p className="cx-home-meta">
        <span data-testid="s-home-project-status" data-status={project.status}>
          {archived ? strings.home_status_archived : strings.home_status_active}
        </span>
        {project.buildingType === null ? null : (
          <>
            <Separator />
            {strings[BUILDING_TYPE_LABEL[project.buildingType]]}
          </>
        )}
        <Separator />
        <span className="cx-home-meta-date" data-testid="s-home-project-last-activity">
          {fill(strings.home_project_updated, { date: lastActivity(project.updatedAt) })}
        </span>
      </p>

      {/* L-REG-07 made visible: every project shows the edition it pinned, and the link is how a
          reader reaches it (R-UI-031). A frame-internal move, so it travels through the router. */}
      <Link className="cx-home-pin cx-reticle" data-testid="s-home-project-ruleset" href={`${shellHref(tenantId, "projects")}/p/${project.projectId}/settings/ruleset`}>
        {strings.home_project_ruleset}
      </Link>

      <div className="cx-home-stats" data-testid="s-home-quick-stats">
        {QUICK_STATS.map((stat) => (
          <span key={stat.testId} data-testid={stat.testId}>
            <span className="cx-home-stat-count">{stat.of(project)}</span> <span className="cx-home-stat-label">{strings[stat.label]}</span>
          </span>
        ))}
      </div>

      <div className="cx-home-doors">
        <Button variant="ghost" data-testid="project-edit" onClick={() => onEdit(project)}>
          {strings.home_project_edit}
        </Button>
        {/* The doors stay enabled — a retry is never disarmed (§1). */}
        {archived ? (
          <Button variant="ghost" data-testid="project-restore" loading={pending} onClick={() => move(restoreProjectAction)}>
            {strings.home_project_restore}
          </Button>
        ) : (
          <Button variant="ghost" data-testid="project-archive" loading={pending} onClick={() => move(archiveProjectAction)}>
            {strings.home_project_archive}
          </Button>
        )}
      </div>

      {refusal === null ? null : <RefusalState refusal={refusalOf(refusal)} evidence={{ href: shellHref(tenantId, "projects"), label: strings.home_evidence_projects }} />}
    </li>
  );
}

/** The meta line's divider: punctuation, so it is hidden from the accessibility tree (R-UI-012). */
function Separator(): ReactNode {
  return (
    <span aria-hidden="true">
      {" "}
      ·{" "}
    </span>
  );
}

/**
 * I-37: last activity is an absolute date through the format seam, never a ticking relative one —
 * a "3 minutes ago" is text no baseline can hold and no reader can act on.
 */
function lastActivity(updatedAt: Date): string {
  const at = new Date(updatedAt);
  return formatDate({ year: at.getFullYear(), month: at.getMonth() + 1, day: at.getDate() });
}
