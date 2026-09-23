"use client";
// The bar-schedule workspace, bound (docs/design/s-bbs.md). This is the one file that may reach both
// `src/ui` and `src/modules`: it hands the presentational workspace the SHIPPED renderers, the ids
// AM-09 §1 keeps in one registry a module may not import, and the one door the error cell owns —
// and adds nothing of its own to any of them.
//
// It also holds what the workspace cannot: the crumb R-UI-084 makes a screen declare, the lane's
// tabs aside, and the re-read the error cell's retry runs.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { BbsWorkspace, type BbsChrome, type BbsJobStep } from "@/modules/takeoff/bbs-ui/workspace";
import type { BbsView } from "@/modules/takeoff/bbs-ui/view";
import { IconInfo } from "@/ui/icons";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { JobTimeline, useTrackedJobs, type TrackedJob } from "@/ui/patterns/job-timeline";
import { Button, EmptyState, EnumLabel, ErrorState, IdChip, Skeleton, Tooltip } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/primitives/overlay";
import { useShellPage } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { useTakeoffTabsAside } from "../nav";
import { exportSchedule, type DoorAnswer } from "./actions";
import type { Demonstration } from "./demonstration";

/** A door's answer, as the workspace reads one: the value, or the refusal it re-raises in place. */
function carried<T>(answer: DoorAnswer<T>): T {
  if (answer.ok) return answer.answer;
  throw Object.assign(new Error(answer.refusal), { refusalCode: answer.refusal });
}

/** The lane's tabs row, filled by the surface standing in it (Direction §3.2). */
function TabsAside({ children }: { children?: ReactNode }) {
  return useTakeoffTabsAside(children ?? null);
}

/**
 * The `(i)` the cutting-stock heading carries: the shipped Popover, composed here because a module
 * may not reach the overlay primitives and a compound is a composition, not a renderer (I-bbs-5).
 */
function StockNote({ label, body }: { label: string; body: string }) {
  return (
    <Popover>
      {/* The shipped info glyph, not a bare letter: a lone `i` reads as a stray character rather
          than as a control a reader can open (R-UI-003, I-bbs-5). */}
      <PopoverTrigger className="cx-bbs-note" aria-label={label}>
        <IconInfo size="sm" />
      </PopoverTrigger>
      <PopoverContent aria-label={label}>{body}</PopoverContent>
    </Popover>
  );
}

/** The shipped renderers, bound once: what a reader sees is what every suite of this screen mounts. */
const CHROME: BbsChrome = {
  // AM-09 §1: the module may not import the registry (ARCH-01), so every id it publishes is read
  // HERE, where the registry is lawfully reachable, and handed down with the rest of its chrome.
  testIds: {
    screen: TESTIDS.bbs.screen,
    answer: TESTIDS.bbs.answer,
    revision: TESTIDS.bbs.revision,
    stock: TESTIDS.bbs.stock,
    grid: TESTIDS.bbs.grid,
    member: TESTIDS.bbs.member,
    row: TESTIDS.bbs.row,
    lap: TESTIDS.bbs.lap,
    summary: TESTIDS.bbs.summary,
    summaryRow: TESTIDS.bbs.summaryRow,
    empty: TESTIDS.bbs.empty,
    export: TESTIDS.bbs.export,
    jobs: TESTIDS.bbs.jobs,
    documentLink: TESTIDS.bbs.documentLink,
  },
  DataTable,
  EmptyState,
  ErrorState,
  RefusalState,
  IdChip,
  EnumLabel,
  Skeleton,
  Tooltip,
  Note: StockNote,
  JobTimeline,
  Button,
  TabsAside,
};

export interface BbsScreenProps {
  readonly view: BbsView | null;
  readonly tenantId: string;
  readonly projectId: string;
  /** Whether this reader holds MEASURE on this project (I-bbs-1). */
  readonly permitted: boolean;
  /** The fault the read left behind, quoted verbatim where the schedule could not be read (B-21). */
  readonly reportId: string | null;
  /** The newest schedule this project has issued, where one exists — the link a finished render offers. */
  readonly documentId: string | null;
  /** The evidence instrument's demonstration, where the address asked for one state by name. */
  readonly demonstration?: Demonstration | null;
}

export function BbsScreen({ view, tenantId, projectId, permitted, reportId, documentId, demonstration }: BbsScreenProps) {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [watching, setWatching] = useState<string | null>(null);

  // R-UI-084: the screen declares its own crumb, through the frame's slot (`useShellPage`).
  useShellPage(strings.takeoff_nav_bbs);

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

  /** Where a refused render is resolved: the surface the bars come from (R-UI-020's evidence). */
  const evidence = useMemo(() => ({ href: `/t/${tenantId}/p/${projectId}/takeoff/register`, label: strings.bbs_empty_action }), [projectId, tenantId]);

  /**
   * The job this screen started, watched through the one register that watches jobs (I-112). A
   * render that succeeds re-reads the page in place, which is how the issue it filed becomes the
   * link beside the timeline — no reload, and no second idea of where a document lives (I-270).
   */
  const tracked = useMemo<TrackedJob[]>(
    () => (watching === null ? [] : [{ jobId: watching, kind: "bbs-render", subject: view?.campaignId ?? projectId, evidence }]),
    [evidence, projectId, view?.campaignId, watching],
  );
  const { steps, lost } = useTrackedJobs(tracked, { onSucceeded: () => router.refresh() });

  const doors = useMemo(
    () => ({
      exportSchedule: async () => carried(await exportSchedule(projectId)),
      refusalOf: (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry>>)[code],
      // R-UI-050's error cell owns the one door that clears it: the read is the server component's,
      // so re-running it IS re-rendering this route — never a second reading beside the first (B-17).
      retry: () => router.refresh(),
    }),
    [projectId, router],
  );

  const jobs = useMemo(() => ({ steps: steps as readonly BbsJobStep[], lost, documentId }), [documentId, lost, steps]);

  return (
    <BbsWorkspace
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
