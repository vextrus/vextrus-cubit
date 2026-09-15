"use client";
// The schedules and notes workspace, bound (docs/design/s-schedules.md, the register's I-170). This
// is the one file that may reach both `src/ui` and `src/modules`: it hands the presentational
// workspace the SHIPPED renderers, the ids AM-09 §1 keeps in one registry a module may not import,
// the addresses the route tree owns, and the lane's own doors — and adds nothing of its own to any
// of them.
//
// It also holds what the workspace cannot: the fault the read left behind, with the report id and
// the retry R-UI-050 asks for, the reading a retry answered, and the crumb R-UI-084 makes a screen
// declare.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Consequence, TranscribeSheetNotesInput } from "@/core/acts";
import { SchedulesWorkspace, type SchedulesChrome, type SchedulesDoors, type PreviewAnswer } from "@/modules/takeoff/schedules-ui";
import type { SchedulesView } from "@/modules/takeoff/schedules-ui/view";
import type { Demonstration } from "./demonstration";
// The address module by name, never the lane's barrel: the barrel also carries the trace's store, and
// a client component that reaches it pulls the database driver into the browser bundle (ARCH-01).
import { selectionAddress } from "@/modules/takeoff/trace/address";
import { EvidenceLink } from "@/ui/patterns/evidence-link";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button, EmptyState, EnumLabel, IdChip, NumberInput, Skeleton, Tooltip, UnitBadge } from "@/ui/primitives/core";
import { DataTable } from "@/ui/primitives/data";
import { useInspector, useShellPage } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { useTakeoffTabsAside } from "../nav";
import { commitTranscribeSheetNotes, previewTranscribeSheetNotes, readSchedules, type DoorAnswer } from "./actions";

/** The lane's tabs row, filled by the surface standing in it (Direction §3.2). */
function TabsAside({ children }: { children?: ReactNode }) {
  useTakeoffTabsAside(children ?? null);
  return null;
}

/** The frame's ONE right column, filled on selection and absent — width 0 — otherwise (R-UI-080). */
function InspectorMount({ children }: { children?: ReactNode }) {
  useInspector(children ?? null);
  return null;
}

/** The shipped renderers, bound once: what a reader sees is what every suite of this screen mounts. */
const CHROME: SchedulesChrome = {
  // AM-09 §1: the module may not import the registry (ARCH-01), so every id it publishes is read
  // HERE, where the registry is lawfully reachable, and handed down with the rest of its chrome.
  // Each key is named rather than the group spread, so a reader — and the registry's own scan — can
  // see which id this screen in fact publishes.
  testIds: {
    screen: TESTIDS.schedules.screen,
    empty: TESTIDS.schedules.empty,
    sheets: TESTIDS.schedules.sheets,
    sheetRow: TESTIDS.schedules.sheetRow,
    table: TESTIDS.schedules.table,
    cell: TESTIDS.schedules.cell,
    deferral: TESTIDS.schedules.deferral,
    registry: TESTIDS.schedules.registry,
    family: TESTIDS.schedules.family,
    variant: TESTIDS.schedules.variant,
    zone: TESTIDS.schedules.zone,
    notes: TESTIDS.schedules.notes,
    standing: TESTIDS.schedules.standing,
    reading: TESTIDS.schedules.reading,
    proposal: TESTIDS.schedules.proposal,
    proposalValue: TESTIDS.schedules.proposalValue,
    transcribe: TESTIDS.schedules.transcribe,
    inspector: TESTIDS.schedules.inspector,
  },
  navTestId: TESTIDS.takeoff.navSchedules,
  DataTable,
  RefusalState,
  ConsequenceDialog,
  EmptyState,
  Button,
  NumberInput,
  Skeleton,
  IdChip,
  EnumLabel,
  UnitBadge,
  EvidenceLink,
  Tooltip,
  TabsAside,
  InspectorMount,
};

/** A door's answer, as the workspace reads one: the value, or the refusal it re-raises in place. */
function carried<T>(answer: DoorAnswer<T>): T {
  if (answer.ok) return answer.answer;
  throw Object.assign(new Error(answer.refusal), { refusalCode: answer.refusal });
}

/** A preview the lane answered, typed as the dialog reads one — the Consequence is the seam's. */
const previewed = (answer: { consequence: unknown; consequenceDigest: string }): PreviewAnswer => ({
  consequence: answer.consequence as Consequence,
  consequenceDigest: answer.consequenceDigest,
});

export interface SchedulesScreenProps {
  readonly view: SchedulesView | null;
  readonly tenantId: string;
  readonly projectId: string;
  /** Whether this reader holds MEASURE on this project (L-ACT-03, I-256). */
  readonly permitted: Readonly<Record<string, boolean>>;
  /** The fault the read left behind, quoted verbatim where the sheets could not be read (B-21). */
  readonly reportId: string | null;
  /**
   * The evidence instrument's demonstration, where the address asked for one state by name and this
   * installation armed the door (`?__state=`, `./demonstration`). It replaces the reading and the
   * flags the state is derived from, and nothing else: the same workspace, the same renderers, the
   * same derivation, so what a reviewer looks at is the screen and not a picture of it.
   */
  readonly demonstration?: Demonstration | null;
}

export function SchedulesScreen({ view, tenantId, projectId, permitted, reportId, demonstration }: SchedulesScreenProps) {
  const [held, setHeld] = useState<SchedulesView | null>(view);
  const [offline, setOffline] = useState(false);
  const [fault, setFault] = useState<unknown>(null);

  // R-UI-084: the screen declares its own crumb, through the frame's slot (`useShellPage`).
  useShellPage(strings.takeoff_nav_schedules);

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

  /**
   * The doors, held steady across renders. The workspace hands both slot regions a node memoised on
   * what it shows, and a `doors` object rebuilt on every render would change that node's identity on
   * every render — which, since setting a slot re-renders the frame that holds it, is a loop rather
   * than an inspector (the register's own precedent).
   */
  const doors = useMemo<SchedulesDoors>(
    () => ({
      schedules: async ({ projectId: asked }: { projectId: string }) => carried(await readSchedules(asked)),
      previewTranscribeSheetNotes: async ({ input }: { input: TranscribeSheetNotesInput }) => previewed(carried(await previewTranscribeSheetNotes(input))),
      commitTranscribeSheetNotes: async ({ input, consequenceDigest }: { input: TranscribeSheetNotesInput; consequenceDigest: string }) =>
        carried(await commitTranscribeSheetNotes(input, consequenceDigest)),
    }),
    [],
  );

  /** The addresses this screen links, composed where the route tree is (ARCH-01, B-17). */
  const addresses = useMemo(
    () => ({
      selection: (sheet: { drawingId: string; layoutName: string }, sourceKeys: readonly string[]) => selectionAddress(tenantId, projectId, { ...sheet, sourceKeys }),
      drawings: `/t/${tenantId}/p/${projectId}/drawings`,
      participants: `/t/${tenantId}/p/${projectId}/settings/participants`,
    }),
    [projectId, tenantId],
  );

  /**
   * The error cell's retry: a read that answers stands the screen up again, and a read that faults
   * again is raised to the boundary that mints the next report id — a press that returns with
   * nothing said is the silence R-UI-020 forbids (ARCH-03, B-21).
   */
  const retry = useCallback((): void => {
    void readSchedules(projectId)
      .then((answer) => setHeld(carried(answer)))
      .catch((thrown: unknown) => setFault(() => thrown));
  }, [projectId]);

  // Thrown in render, where React's own boundary is: a rejected promise reaches no boundary at all.
  if (fault !== null) throw fault;

  return (
    <SchedulesWorkspace
      view={demonstration === undefined || demonstration === null ? held : demonstration.view}
      tenantId={tenantId}
      projectId={projectId}
      permitted={demonstration?.permitted ?? permitted}
      offline={demonstration?.offline ?? offline}
      state={demonstration === undefined || demonstration === null ? (held === null ? "error" : null) : demonstration.state}
      refusal={demonstration?.refusal ?? null}
      reportId={demonstration?.reportId ?? reportId}
      onRetry={retry}
      chrome={CHROME}
      doors={doors}
      addresses={addresses}
    />
  );
}
