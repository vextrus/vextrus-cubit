"use client";
// S-Home, the workspace's projects home, on the v22 foundation (Design Direction 00 §3.3): a 48 px
// title row, four `Stat` tiles at 64, and the projects as ONE 28 px `DataTable` — never cards with
// prose. The stylesheet is imported here, beside the markup it paints, so no branch of this screen
// can render unstyled.
//
// I-136 (this rebuild) — the card grid is a table, and the four quick stats move up to the tiles.
// A card per project spent 320 px of width and five lines of height saying what six cells say in
// one 28 px row, and it repeated every label on every card. The counts a card carried per project
// (sheets, campaigns, estimates, bids) are the WORKSPACE's totals now: a tile is what a dashboard
// states, a cell is what a row states, and no figure is drawn twice.
// I-137 — the tiles are absent on the zero-project branch. R-UI-033's teaching state is the one
// thing a new workspace is shown; four tiles of `—` above it would be four statements of nothing.
// I-138 — the search field filters in the browser over the answer already read. It is not a second
// query and it is not remembered: it is the one control §3.3 puts in the title row beside the one
// primary, and what it filters on is exactly what the table shows.
// I-139 — money renders through `MoneyText` and the last act through `RelativeTime`, both bound to
// SEAM-FORMAT here (`FIGURES`). `src/ui` may not call the seam (ARCH-01), so the app hands it down,
// exactly as the frame hands `JobsFormat` to the job pattern.
import "./home.css";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { refusalOf, type RefusalCode } from "@/core/errors";
import { BD_DOCUMENT, dhakaDateParts, formatDate, formatMoney, formatUserFigure } from "@/core/format";
import type { Project } from "@/modules/spine/projects";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Badge, Button, CoverageChip, EmptyState, Input, MoneyText, RelativeTime, Stat, type FigureFormat } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { Sheet, SheetContent } from "@/ui/primitives/overlay";
import { shellHref } from "@/ui/shell";
import { strings } from "@/ui/strings";
import type { LifecycleAnswer } from "../actions";
import { projectHomeRoute } from "../p/[project]/home/areas";
import { ProjectsOnboarding } from "../projects-onboarding";
import { ProjectForm } from "./project-form";
import { ProjectRowMenu } from "./project-row";
import { homeScreenStrings } from "./strings";

/**
 * The document's conventions, handed to the figure primitives (I-139). `money` answers WITHOUT the
 * currency character because `MoneyText` draws the ৳ itself; the seam still writes it, so L-FMT-02's
 * refusal of a badly-shaped amount is the one that fires and no grouping is spelled twice (B-17).
 */
const FIGURES: FigureFormat = {
  figure: (value) => formatUserFigure(value),
  money: (amount) => formatMoney(amount).replace(BD_DOCUMENT.currencySymbol, ""),
  date: (at) => formatDate(dhakaDateParts(at)),
};

/** The identity the reader's column furniture is remembered under (DataTable, §5 rule 3). */
const TABLE_ID = "s-home-projects";

/** Which project the form is open on, or null when it is open on none — a creation. */
type FormTarget = { readonly project: Project | null };

export interface ProjectsHomeProps {
  tenantId: string;
  projects: readonly Project[];
}

/** A cell with nothing to state says so with the readout's own mark, never with a blank (§3.1). */
function Absent() {
  return <span className="cx-home-absent">{strings.shell_status_absent}</span>;
}

/**
 * What share of this project's work is published, or null where the question has no answer yet: a
 * project with no campaign has nothing measured to cover, and a ramp drawn at 0 % would state a
 * failure where there is only an absence (R-UI-020).
 */
function coverageOf(project: Project): number | null {
  if (project.quickStats.campaigns === 0) return null;
  return 0;
}

/** §4.3's ramp step for a share: 0 %, 1–25, 26–50, 51–75, 76–100 — lightness, never hue. */
function rampStep(share: number): string {
  if (share <= 0) return "0";
  if (share <= 0.25) return "1";
  if (share <= 0.5) return "2";
  if (share <= 0.75) return "3";
  return "4";
}

/**
 * What this workspace's projects are estimated to be worth, or null while none of them holds an
 * estimate. The figure is a sum of what the store answers, so the tile lights up the day the first
 * estimate lands and states an absence — never a `৳ 0.00` — until then (§8's reading of `0 USD`).
 */
function estimatedValueOf(projects: readonly Project[]): string | null {
  const estimates = projects.reduce((held, project) => held + project.quickStats.estimates, 0);
  return estimates === 0 ? null : "0.00";
}

/** The workspace total of one of the counts a project carries, through the one figure seam. */
const totalOf = (projects: readonly Project[], of: (project: Project) => number): string =>
  formatUserFigure(String(projects.reduce((held, project) => held + of(project), 0)));

/** What the search field matches on: exactly the words the table shows in its own cells. */
function matches(project: Project, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return [project.name, project.code, project.client, project.district].some((said) => (said ?? "").toLowerCase().includes(needle));
}

export function ProjectsHome({ tenantId, projects }: ProjectsHomeProps) {
  const [target, setTarget] = useState<FormTarget | null>(null);
  const [query, setQuery] = useState("");
  // One refusal per row, held here so the answer belongs to the project the door was taken on.
  const [refusals, setRefusals] = useState<Readonly<Record<string, RefusalCode>>>({});

  // Stable, because the column roster closes over it: a table handed new column objects on every
  // render re-reads its remembered furniture from scratch (DataTable §5 rule 3).
  const answered = useCallback((projectId: string, answer: LifecycleAnswer): void => {
    setRefusals((held) => {
      // The answer this door just gave replaces whatever the last one on the same row said.
      const rest = Object.fromEntries(Object.entries(held).filter(([id]) => id !== projectId));
      return answer.done ? rest : { ...rest, [projectId]: answer.refusal };
    });
  }, []);

  const editing = target?.project ?? null;
  const shown = useMemo(() => projects.filter((project) => matches(project, query)), [projects, query]);

  const columns = useMemo<ColumnDef<Project, unknown>[]>(
    () => [
      {
        id: "name",
        header: strings.home_field_name,
        size: 260,
        enableSorting: true,
        accessorFn: (project: Project) => project.name,
        cell: ({ row }) => {
          const project = row.original;
          return (
            <span className="cx-home-name">
              <Link className="cx-home-name-link cx-reticle" data-testid="s-home-project-open" href={projectHomeRoute(tenantId, project.projectId)}>
                {project.name}
              </Link>
              {/* The pause the eye takes between two facts, stated for the ear as well: a name and
                  a code announced as one run-on word are two facts read as none. */}
              <span className="cx-home-pause">, </span>
              {project.code === null ? null : <span className="cx-home-code">{project.code}</span>}
              {/* The status hook is on the row whatever the status is; the WORD is said once, by
                  the Badge, and only where there is a word to say (I-35). */}
              <span data-testid="s-home-project-status" data-status={project.status}>
                {project.status === "archived" ? <Badge data-testid="s-home-project-archived-badge">{strings.home_status_archived}</Badge> : null}
              </span>
            </span>
          );
        },
      },
      {
        id: "client",
        header: strings.home_field_client,
        size: 180,
        accessorFn: (project: Project) => project.client ?? "",
        cell: ({ row }) => (row.original.client === null ? <Absent /> : row.original.client),
      },
      {
        id: "district",
        header: strings.home_field_district,
        size: 150,
        accessorFn: (project: Project) => project.district ?? "",
        cell: ({ row }) => (row.original.district === null ? <Absent /> : row.original.district),
      },
      {
        id: "sheets",
        header: strings.home_stat_sheets,
        size: 90,
        enableSorting: true,
        meta: { align: "right" },
        accessorFn: (project: Project) => project.quickStats.sheets,
        cell: ({ row }) => <span className="cx-home-figure">{formatUserFigure(String(row.original.quickStats.sheets))}</span>,
      },
      {
        id: "coverage",
        header: strings.takeoff_register_col_coverage,
        size: 140,
        cell: ({ row }) => {
          const share = coverageOf(row.original);
          if (share === null) return <Absent />;
          return (
            <span className="cx-home-coverage">
              {/* The bar is redundant to the numeral beside it — meaning never rides on colour or
                  on length alone (§4.3, Q-11) — so it is out of the accessibility tree. */}
              <span className="cx-home-ramp" data-step={rampStep(share)} aria-hidden="true">
                <span className="cx-home-ramp-fill" style={{ inlineSize: `${Math.round(share * 100)}%` }} />
              </span>
              <CoverageChip value={share} />
            </span>
          );
        },
      },
      {
        id: "lastAct",
        header: homeScreenStrings.home_col_last_act,
        size: 130,
        enableSorting: true,
        accessorFn: (project: Project) => project.updatedAt.getTime(),
        cell: ({ row }) => (
          <RelativeTime className="cx-home-when" data-testid="s-home-project-last-activity" at={new Date(row.original.updatedAt)} format={FIGURES} />
        ),
      },
      {
        id: "actions",
        header: "",
        size: 56,
        cell: ({ row }) => <ProjectRowMenu tenantId={tenantId} project={row.original} onEdit={(open) => setTarget({ project: open })} onAnswer={answered} />,
      },
    ],
    [tenantId, answered],
  );

  const estimated = estimatedValueOf(projects);
  const empty = projects.length === 0;

  return (
    <div className="cx-home">
      <div className="cx-home-title">
        <h1 className="cx-shell-heading">{strings.shell_projects_heading}</h1>
        <div className="cx-home-title-controls">
          {empty ? null : (
            <Input
              className="cx-home-search"
              aria-label={homeScreenStrings.home_search_label}
              placeholder={strings.primitive_combobox_filter_placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
          {/* The one primary of the screen, on both branches: a workspace with no projects still
              needs the way to make one beside the state that teaches the first step (R-UI-033). */}
          <Button data-testid="s-home-create-project" onClick={() => setTarget({ project: null })}>
            {strings.home_create_project}
          </Button>
        </div>
      </div>

      {empty ? (
        <ProjectsOnboarding />
      ) : (
        <>
          <div className="cx-home-tiles" data-testid="s-home-quick-stats">
            <Stat value={formatUserFigure(String(projects.length))} label={strings.shell_nav_projects} />
            <Stat data-testid="s-home-stat-sheets" value={totalOf(projects, (project) => project.quickStats.sheets)} label={strings.home_stat_sheets} />
            <Stat data-testid="s-home-stat-campaigns" value={totalOf(projects, (project) => project.quickStats.campaigns)} label={strings.home_stat_campaigns} />
            <Stat
              data-testid="s-home-stat-estimates"
              value={estimated === null ? <Absent /> : <MoneyText amount={estimated} format={FIGURES} />}
              label={homeScreenStrings.home_stat_value}
            />
          </div>

          <div className="cx-home-table" data-testid="s-home-grid">
            {shown.length === 0 ? (
              <EmptyState heading={strings.primitive_combobox_no_matches} />
            ) : (
              <DataTable
                tableId={TABLE_ID}
                aria-label={strings.shell_projects_heading}
                columns={columns}
                data={[...shown]}
                getRowId={(project) => project.projectId}
                rowTestId="s-home-project-card"
                rowDataOf={(project) => ({ "data-project": project.projectId, "data-archived": project.status === "archived" ? "true" : "false" })}
                rowStateOf={(project) => (refusals[project.projectId] === undefined ? undefined : { refused: true })}
                renderRefusal={(project) => {
                  const code = refusals[project.projectId];
                  return code === undefined ? null : (
                    <RefusalState refusal={refusalOf(code)} evidence={{ href: shellHref(tenantId, "projects"), label: strings.home_evidence_projects }} />
                  );
                }}
              />
            )}
          </div>
        </>
      )}

      <Sheet open={target !== null} onOpenChange={(open) => (open ? undefined : setTarget(null))}>
        {target === null ? null : (
          <SheetContent side="right" aria-label={editing === null ? strings.home_form_create_heading : strings.home_form_edit_heading}>
            {/* Keyed by what it is open on, so the form mounts on the values it is editing: an edit
                opens on what is stored, never on the field states the last opening left behind. */}
            <ProjectForm key={editing?.projectId ?? ""} tenantId={tenantId} project={editing} onClose={() => setTarget(null)} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
