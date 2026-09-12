"use client";
// One project as a ROW of S-Home's table (Design Direction 00 §3.3: "the project dashboard as four
// stat tiles above a table, not cards with prose"). The card this file used to draw is gone; what
// stays is the part the card was the only home of — the three doors R-SPINE-010 gives a project.
//
// I-140 (this rebuild) — the three doors live in the row's `⋯` menu. Edit, Archive/Restore and the
// rule-set pin were three differently-weighted controls on a card: two ghost buttons and a link.
// §1's "≤ 1 primary button per region" and §8's "one button style for Edit/Archive (⋯ menu)" make
// them one menu behind one 28 px trigger, which is also what gives the table its last column.
// I-35 stands: archive is reversible, so neither door is danger and neither is an act.
import Link from "next/link";
import { useTransition } from "react";
import type { Project } from "@/modules/spine/projects";
import { IconMoreHorizontal } from "@/ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/primitives/overlay";
import { useFailureHandOff } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { rulesetRoute } from "../p/[project]/home/areas";
import { archiveProjectAction, restoreProjectAction, type LifecycleAnswer } from "../actions";
import { homeScreenStrings } from "./strings";
import { TESTIDS } from "@/ui/testids";

export interface ProjectRowMenuProps {
  tenantId: string;
  project: Project;
  /** Opens the shared form on this project — the row holds no form of its own. */
  onEdit: (project: Project) => void;
  /** What a lifecycle door answered, held by the screen so one refusal stands per row. */
  onAnswer: (projectId: string, answer: LifecycleAnswer) => void;
}

export function ProjectRowMenu({ tenantId, project, onEdit, onAnswer }: ProjectRowMenuProps) {
  const [pending, start] = useTransition();
  // A failed door is a failure, not a silence: closing over a discarded promise would leave the
  // control simply stopping being busy with nothing said (ARCH-03, B-21).
  const handing = useFailureHandOff();
  const archived = project.status === "archived";

  const move = (door: (tenantId: string, projectId: string) => Promise<LifecycleAnswer>): void => {
    if (pending) return;
    start(() => handing(async () => onAnswer(project.projectId, await door(tenantId, project.projectId))));
  };

  return (
    <DropdownMenu>
      {/* The shipped ghost Button worn as a square icon trigger: its height is `--control-h` like
          every other control on the screen, and its name is a word, never the glyph (R-UI-012). */}
      <DropdownMenuTrigger className="cx-home-row-menu" aria-label={homeScreenStrings.home_row_actions} aria-busy={pending || undefined}>
        <IconMoreHorizontal size="md" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem data-testid={TESTIDS.project.edit} onSelect={() => onEdit(project)}>
          {strings.home_project_edit}
        </DropdownMenuItem>
        {/* The doors stay enabled — a retry is never disarmed (§1). */}
        {archived ? (
          <DropdownMenuItem data-testid={TESTIDS.project.restore} onSelect={() => move(restoreProjectAction)}>
            {strings.home_project_restore}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem data-testid={TESTIDS.project.archive} onSelect={() => move(archiveProjectAction)}>
            {strings.home_project_archive}
          </DropdownMenuItem>
        )}
        {/* L-REG-07 made visible: every project shows the edition it pinned, one press away
            (R-UI-031). A frame-internal move, so it travels through the router. */}
        <DropdownMenuItem asChild data-testid={TESTIDS.sHome.projectRuleset}>
          <Link href={rulesetRoute(tenantId, project.projectId)}>{strings.home_project_ruleset}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
