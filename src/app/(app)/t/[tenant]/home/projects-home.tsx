"use client";
// S-Home, the workspace's projects home. The stylesheet is imported here, beside the markup it
// paints, so no branch of this screen can render unstyled.
//
// Both branches carry the create door: a workspace with no projects still needs the way to make one
// beside the empty state that teaches the first step (R-UI-033). The zero-project branch is the
// shipped teaching state and nothing else — a grid and a documents region that both said "nothing
// here" would drown the one notice that says what to do.
import "./home.css";

import { useId, useState } from "react";
import type { RefusalCode } from "../../../../../core/errors";
import type { Project } from "../../../../../modules/spine/projects";
import { Button } from "../../../../../ui/primitives/core";
import { Sheet, SheetContent } from "../../../../../ui/primitives/overlay";
import { strings } from "../../../../../ui/strings";
import type { LifecycleAnswer } from "../actions";
import { ProjectsOnboarding } from "../projects-onboarding";
import { ProjectCard } from "./project-card";
import { ProjectForm } from "./project-form";

/** Which project the form is open on, or null when it is open on none — a creation. */
type FormTarget = { readonly project: Project | null };

export interface ProjectsHomeProps {
  tenantId: string;
  projects: readonly Project[];
}

export function ProjectsHome({ tenantId, projects }: ProjectsHomeProps) {
  const [target, setTarget] = useState<FormTarget | null>(null);
  // One refusal per card, held here so the answer belongs to the project the door was taken on.
  const [refusals, setRefusals] = useState<Readonly<Record<string, RefusalCode>>>({});
  const documentsId = useId();

  const answered = (projectId: string, answer: LifecycleAnswer): void => {
    setRefusals((held) => {
      // The answer this door just gave replaces whatever the last one on the same card said.
      const rest = Object.fromEntries(Object.entries(held).filter(([id]) => id !== projectId));
      return answer.done ? rest : { ...rest, [projectId]: answer.refusal };
    });
  };

  const editing = target?.project ?? null;

  return (
    <div className="cx-home">
      <div className="cx-home-header">
        <h1 className="cx-shell-heading">{strings.shell_projects_heading}</h1>
        <Button data-testid="s-home-create-project" onClick={() => setTarget({ project: null })}>
          {strings.home_create_project}
        </Button>
      </div>

      {projects.length === 0 ? (
        <ProjectsOnboarding />
      ) : (
        <>
          <ul className="cx-home-grid" data-testid="s-home-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.projectId}
                tenantId={tenantId}
                project={project}
                onEdit={(open) => setTarget({ project: open })}
                refusal={refusals[project.projectId] ?? null}
                onAnswer={answered}
              />
            ))}
          </ul>

          {/* The honest M0 region: it says why it is empty and promises no action, because none
              exists yet — no project has produced a document to list (R-UI-020). */}
          <section className="cx-home-documents" data-testid="s-home-recent-documents" aria-labelledby={documentsId}>
            <h2 className="cx-home-documents-heading" id={documentsId}>
              {strings.home_documents_heading}
            </h2>
            <p className="cx-home-documents-empty">{strings.home_documents_empty}</p>
          </section>
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
