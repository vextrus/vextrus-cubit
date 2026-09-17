"use client";
// The draft-BOQ workspace, bound (docs/design/s-boq.md, the register's I-170). This is the one file
// that may reach both `src/ui` and `src/modules`: it hands the presentational workspace the SHIPPED
// renderers, the ids AM-09 §1 keeps in one registry a module may not import, the lane's own door, and
// the job register that watches a render — and adds nothing of its own to any of them.
//
// It also holds what the workspace cannot: the crumb R-UI-084 makes a screen declare, the lane's tabs
// aside, the fault the read left behind, and the one re-read the error cell's retry runs.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { BoqWorkspace, type BoqChrome, type BoqJobStep } from "@/modules/takeoff/boq/workspace";
import type { BoqView } from "@/modules/takeoff/boq/view";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { JobTimeline, useTrackedJobs, type TrackedJob } from "@/ui/patterns/job-timeline";
import { BasisChip, Button, CoverageChip, EmptyState, EnumLabel, ErrorState, IdChip, Skeleton, Tooltip, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { useShellPage } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { useTakeoffTabsAside } from "../nav";
import { exportDraft, type DoorAnswer } from "./actions";
import type { Demonstration } from "./demonstration";

/** The lane's tabs row, filled by the surface standing in it (Direction §3.2). */
function TabsAside({ children }: { children?: ReactNode }) {
  useTakeoffTabsAside(children ?? null);
  return null;
}

/** The shipped renderers, bound once: what a reader sees is what every suite of this screen mounts. */
const CHROME: BoqChrome = {
  // AM-09 §1: the module may not import the registry (ARCH-01), so every id it publishes is read
  // HERE, where the registry is lawfully reachable, and handed down with the rest of its chrome.
  testIds: {
    screen: TESTIDS.boq.screen,
    answer: TESTIDS.boq.answer,
    grid: TESTIDS.boq.grid,
    bill: TESTIDS.boq.bill,
    line: TESTIDS.boq.line,
    subtotal: TESTIDS.boq.subtotal,
    export: TESTIDS.boq.export,
    empty: TESTIDS.boq.empty,
    revision: TESTIDS.boq.revision,
    taxonomyVersion: TESTIDS.boq.taxonomyVersion,
    draft: TESTIDS.boq.draft,
    jobs: TESTIDS.boq.jobs,
    documentLink: TESTIDS.boq.documentLink,
  },
  DataTable,
  EmptyState,
  ErrorState,
  RefusalState,
  IdChip,
  EnumLabel,
  BasisChip,
  CoverageChip,
  UnitBadge,
  Skeleton,
  JobTimeline,
  Tooltip,
  Button,
  TabsAside,
};

/** A door's answer, as the workspace reads one: the value, or the refusal it re-raises in place. */
function carried<T>(answer: DoorAnswer<T>): T {
  if (answer.ok) return answer.answer;
  throw Object.assign(new Error(answer.refusal), { refusalCode: answer.refusal });
}

export interface BoqScreenProps {
  readonly view: BoqView | null;
  readonly tenantId: string;
  readonly projectId: string;
  /** Whether this reader holds MEASURE on this project (L-ACT-03, Decision §2). */
  readonly permitted: boolean;
  /** The fault the read left behind, quoted verbatim where the draft could not be read (B-21). */
  readonly reportId: string | null;
  /** The newest draft this project has issued, where one exists — the link a finished render offers. */
  readonly documentId: string | null;
  /** The evidence instrument's demonstration, where the address asked for one state by name. */
  readonly demonstration?: Demonstration | null;
}

export function BoqScreen({ view, tenantId, projectId, permitted, reportId, documentId, demonstration }: BoqScreenProps) {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [watching, setWatching] = useState<string | null>(null);

  // R-UI-084: the screen declares its own crumb, through the frame's slot (`useShellPage`).
  useShellPage(strings.takeoff_nav_boq);

  useEffect(() => {
    const settle = (): void => setOffline(!navigator.onLine);
    settle();
    window.addEventListener("online", settle);
    window.addEventListener("offline", settle);
    return () => {
      window.removeEventListener("online", settle);
      window.removeEventListener("offline", settle);
    };
  }, []);

  /** Where a refused render is resolved: the surface the lines come from (R-UI-020's evidence). */
  const evidence = useMemo(() => ({ href: `/t/${tenantId}/p/${projectId}/takeoff/register`, label: strings.boq_register_link }), [projectId, tenantId]);

  /**
   * The job this screen started, watched through the one register that watches jobs (I-112). A
   * render that succeeds re-reads the page in place, which is how the issue it filed becomes the
   * link beside the timeline — no reload, and no second idea of where a document lives (I-270).
   */
  const tracked = useMemo<TrackedJob[]>(
    () => (watching === null ? [] : [{ jobId: watching, kind: "boq-render-draft", subject: view?.campaignId ?? projectId, evidence }]),
    [evidence, projectId, view?.campaignId, watching],
  );
  const { steps, lost } = useTrackedJobs(tracked, { onSucceeded: () => router.refresh() });

  const doors = useMemo(
    () => ({
      exportDraft: async () => carried(await exportDraft(projectId)),
      refusalOf: (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry>>)[code],
      // R-UI-050's error cell owns the one door that clears it: the read is the server component's,
      // so re-running it IS re-rendering this route — never a second reading beside the first (B-17).
      retry: () => router.refresh(),
    }),
    [projectId, router],
  );

  const jobs = useMemo(
    () => ({ steps: steps as readonly BoqJobStep[], lost, documentId }),
    [documentId, lost, steps],
  );

  return (
    <BoqWorkspace
      view={demonstration === undefined || demonstration === null ? view : demonstration.view}
      state={demonstration?.state ?? null}
      permitted={demonstration?.permitted ?? permitted}
      offline={demonstration?.offline ?? offline}
      reportId={demonstration?.reportId ?? reportId}
      refused={demonstration?.refusal ?? null}
      tenantId={tenantId}
      projectId={projectId}
      jobs={jobs}
      onExportStarted={setWatching}
      chrome={CHROME}
      doors={doors}
    />
  );
}
