"use client";
// The level stack editor, bound (docs/design/s-levels.md, the register's I-170). This is the one file
// that may reach both `src/ui` and `src/modules`: it hands the presentational workspace the SHIPPED
// renderers, the ids AM-09 §1 keeps in one registry a module may not import, and the lane's own
// doors — and adds nothing of its own to any of them.
//
// It also holds what the workspace cannot: the fault the read left behind, with the report id and
// the retry R-UI-050 asks for, and the reading a retry answered.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthorStoreyHeightInput, AuthorTypicalRangeInput, InsertLevelInput, RepudiateLevelInput } from "@/core/acts";
import type { Consequence } from "@/core/acts";
import { LevelsWorkspace, type LevelsChrome, type LevelsDoors, type PreviewAnswer } from "@/modules/takeoff/levels-ui";
import type { LevelsView } from "@/modules/takeoff/levels-ui/view";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { BasisChip, Button, CoverageChip, EmptyState, EnumLabel, IdChip, Input, NumberInput, QuantityText, Select, Skeleton, Tooltip, UnitBadge } from "@/ui/primitives/core";
// `humaniseEnum` is the one rule EnumLabel says a SCREAMING value in words by, handed down rather
// than written a second time beside the roster it labels (B-17). It is the component's own file
// because a rule is not a component and the barrel publishes components.
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { DataTable } from "@/ui/primitives/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/primitives/overlay";
import { useInspector } from "@/ui/shell";
import { TESTIDS } from "@/ui/testids";
import { useTakeoffTabsAside } from "../nav";
import {
  commitAuthorStoreyHeight,
  commitAuthorTypicalRange,
  commitInsertLevel,
  commitRepudiateLevel,
  previewAuthorStoreyHeight,
  previewAuthorTypicalRange,
  previewInsertLevel,
  previewRepudiateLevel,
  readLevels,
  type DoorAnswer,
} from "./actions";

/** The lane's tabs row, filled by the surface standing in it (Direction §3.2, I-246). */
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
const CHROME: LevelsChrome = {
  // AM-09 §1: the module may not import the registry (ARCH-01), so every id it publishes is read
  // HERE, where the registry is lawfully reachable, and handed down with the rest of its chrome.
  // Each key is named rather than the group spread, so a reader — and the registry's own scan — can
  // see which id this screen in fact publishes.
  testIds: {
    screen: TESTIDS.levels.screen,
    grid: TESTIDS.levels.grid,
    row: TESTIDS.levels.row,
    rollup: TESTIDS.levels.rollup,
    empty: TESTIDS.levels.empty,
    insert: TESTIDS.levels.insert,
    insertLabel: TESTIDS.levels.insertLabel,
    insertOrdinal: TESTIDS.levels.insertOrdinal,
    insertConfirm: TESTIDS.levels.insertConfirm,
    inspector: TESTIDS.levels.inspector,
    reading: TESTIDS.levels.reading,
    heightValue: TESTIDS.levels.heightValue,
    heightUnit: TESTIDS.levels.heightUnit,
    heightBasis: TESTIDS.levels.heightBasis,
    heightSource: TESTIDS.levels.heightSource,
    authorHeight: TESTIDS.levels.authorHeight,
    repudiate: TESTIDS.levels.repudiate,
    ranges: TESTIDS.levels.ranges,
    rangeRow: TESTIDS.levels.rangeRow,
    rangeFrom: TESTIDS.levels.rangeFrom,
    rangeTo: TESTIDS.levels.rangeTo,
    authorRange: TESTIDS.levels.authorRange,
  },
  DataTable,
  RefusalState,
  ConsequenceDialog,
  EmptyState,
  Button,
  Input,
  NumberInput,
  Select,
  Skeleton,
  IdChip,
  EnumLabel,
  BasisChip,
  CoverageChip,
  QuantityText,
  UnitBadge,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  humaniseEnum,
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

export interface LevelsScreenProps {
  readonly view: LevelsView | null;
  readonly projectId: string;
  /** Which of the three permissions this reader holds on this project (L-ACT-03, I-247). */
  readonly permitted: Readonly<Record<string, boolean>>;
  /** The fault the read left behind, quoted verbatim where the stack could not be read (B-21). */
  readonly reportId: string | null;
}

export function LevelsScreen({ view, projectId, permitted, reportId }: LevelsScreenProps) {
  const [held, setHeld] = useState<LevelsView | null>(view);
  const [offline, setOffline] = useState(false);
  const [fault, setFault] = useState<unknown>(null);

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
  const doors = useMemo<LevelsDoors>(
    () => ({
      levels: async ({ projectId: asked }: { projectId: string }) => carried(await readLevels(asked)),
      previewInsertLevel: async ({ input }: { input: InsertLevelInput }) => previewed(carried(await previewInsertLevel(input))),
      commitInsertLevel: async ({ input, consequenceDigest }: { input: InsertLevelInput; consequenceDigest: string }) => carried(await commitInsertLevel(input, consequenceDigest)),
      previewRepudiateLevel: async ({ input }: { input: RepudiateLevelInput }) => previewed(carried(await previewRepudiateLevel(input))),
      commitRepudiateLevel: async ({ input, consequenceDigest }: { input: RepudiateLevelInput; consequenceDigest: string }) => carried(await commitRepudiateLevel(input, consequenceDigest)),
      previewAuthorStoreyHeight: async ({ input }: { input: AuthorStoreyHeightInput }) => previewed(carried(await previewAuthorStoreyHeight(input))),
      commitAuthorStoreyHeight: async ({ input, consequenceDigest }: { input: AuthorStoreyHeightInput; consequenceDigest: string }) => carried(await commitAuthorStoreyHeight(input, consequenceDigest)),
      previewAuthorTypicalRange: async ({ input }: { input: AuthorTypicalRangeInput }) => previewed(carried(await previewAuthorTypicalRange(input))),
      commitAuthorTypicalRange: async ({ input, consequenceDigest }: { input: AuthorTypicalRangeInput; consequenceDigest: string }) => carried(await commitAuthorTypicalRange(input, consequenceDigest)),
    }),
    [],
  );

  /**
   * The error cell's retry: a read that answers stands the screen up again, and a read that faults
   * again is raised to the boundary that mints the next report id — a press that returns with
   * nothing said is the silence R-UI-020 forbids (ARCH-03, B-21).
   */
  const retry = useCallback((): void => {
    void readLevels(projectId)
      .then((answer) => setHeld(carried(answer)))
      .catch((thrown: unknown) => setFault(() => thrown));
  }, [projectId]);

  // Thrown in render, where React's own boundary is: a rejected promise reaches no boundary at all.
  if (fault !== null) throw fault;

  // R-UI-050's error cell is the workspace's own, so one screen has one root: the read failed,
  // nothing was changed, and the report id a person quotes stands beside the retry this file owns —
  // the read belongs to the route, and the workspace renders what the read answered.
  return (
    <LevelsWorkspace
      view={held ?? { projectId, stack: [], unstatedRanges: [] }}
      permitted={permitted}
      offline={offline}
      state={held === null ? "error" : null}
      reportId={reportId}
      onRetry={retry}
      chrome={CHROME}
      doors={doors}
    />
  );
}
