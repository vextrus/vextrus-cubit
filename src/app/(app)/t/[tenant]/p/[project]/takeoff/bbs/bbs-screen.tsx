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
import { BbsWorkspace, type BbsChrome } from "@/modules/takeoff/bbs-ui/workspace";
import type { BbsView } from "@/modules/takeoff/bbs-ui/view";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { EmptyState, EnumLabel, ErrorState, IdChip, Skeleton, Tooltip } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/primitives/overlay";
import { useShellPage } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { useTakeoffTabsAside } from "../nav";
import type { Demonstration } from "./demonstration";

/** The lane's tabs row, filled by the surface standing in it (Direction §3.2). */
function TabsAside({ children }: { children?: ReactNode }) {
  useTakeoffTabsAside(children ?? null);
  return null;
}

/**
 * The `(i)` the cutting-stock heading carries: the shipped Popover, composed here because a module
 * may not reach the overlay primitives and a compound is a composition, not a renderer (I-bbs-5).
 */
function StockNote({ label, body }: { label: string; body: string }) {
  return (
    <Popover>
      <PopoverTrigger className="cx-bbs-note" aria-label={label}>
        {"i"}
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
  /** The evidence instrument's demonstration, where the address asked for one state by name. */
  readonly demonstration?: Demonstration | null;
}

export function BbsScreen({ view, tenantId, projectId, permitted, reportId, demonstration }: BbsScreenProps) {
  const router = useRouter();
  const [offline, setOffline] = useState(false);

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

  const doors = useMemo(
    () => ({
      refusalOf: (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry>>)[code],
      // R-UI-050's error cell owns the one door that clears it: the read is the server component's,
      // so re-running it IS re-rendering this route — never a second reading beside the first (B-17).
      retry: () => router.refresh(),
    }),
    [router],
  );

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
      chrome={CHROME}
      doors={doors}
    />
  );
}
