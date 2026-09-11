"use client";
// The coverage grid, bound (docs/design/s-coverage.md I-170). This is the one file that may reach
// both `src/ui` and `src/modules`: it hands the presentational workspace the three SHIPPED renderers
// and the lane's own four doors, and adds nothing of its own to either.
//
// It also holds the two cells the workspace cannot hold, because both are about the READ rather than
// about the residue: the fault the read left behind, with the report id and the retry R-UI-050 asks
// for, and the reading itself once a retry has answered.
import { useCallback, useEffect, useState } from "react";
import type { Consequence } from "@/core/acts";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { CoverageWorkspace, type BoundaryCell, type CoverageChrome, type CoverageDensity, type CoverageDoors, type CoveragePreviewAnswer } from "@/modules/takeoff/coverage";
import type { CoverageView } from "@/modules/takeoff/coverage/view";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { Button } from "@/ui/primitives/core";
import {
  commitDeclareNotInProjectScope,
  commitHoldOutOfBill,
  previewDeclareNotInProjectScope,
  previewHoldOutOfBill,
  readCoverage,
  type BoundaryAsk,
  type DoorAnswer,
  type Previewed,
} from "./actions";

/** The shipped renderers, bound once (I-170): what a test mounts is what this route renders. */
const CHROME: CoverageChrome = { Button, RefusalState, ConsequenceDialog };

/** The two act types the doors confirm as (L-ACT-03), named where the ask is shaped and nowhere else. */
const HOLD_OUT_OF_BILL = "HOLD_OUT_OF_BILL";
const DECLARE_NOT_IN_PROJECT_SCOPE = "DECLARE_NOT_IN_PROJECT_SCOPE";

/** The registry, read through its one home — this screen re-words no code (R-UI-020, ARCH-02). */
const refusalOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

/** A door's answer, as the workspace reads one: the value, or the refusal it re-raises in place. */
function carried<T>(answer: DoorAnswer<T>): T {
  if (answer.ok) return answer.answer;
  throw Object.assign(new Error(answer.refusal), { refusalCode: answer.refusal });
}

/** The cell the workspace named, as the lane's own door is asked about one. */
const ask = (type: string, cell: BoundaryCell): BoundaryAsk => ({ type, ...cell });

/** A preview the lane answered, typed as the dialog reads one — the Consequence is the seam's. */
const previewed = (answer: Previewed): CoveragePreviewAnswer => ({
  consequence: answer.consequence as Consequence,
  consequenceDigest: answer.consequenceDigest,
});

export interface CoverageScreenProps {
  readonly view: CoverageView | null;
  readonly projectId: string;
  /** Whether this reader holds SET_BILL_BOUNDARY on this project, read server-side (Decision § 2). */
  readonly permitted: boolean;
  /** The fault the read left behind, quoted verbatim where coverage could not be read (B-21). */
  readonly reportId: string | null;
  /** The cell the address named on mount, or null where it named none (I-193). */
  readonly initialCell: string | null;
}

export function CoverageScreen({ view, projectId, permitted, reportId, initialCell }: CoverageScreenProps) {
  const [held, setHeld] = useState<CoverageView | null>(view);
  // What a door answered when it did not answer a reading: the registered code it carried, or the
  // fault it left — neither is dropped, and neither is spoken by this file (R-UI-020, B-21).
  const [refused, setRefused] = useState<string | null>(null);
  const [fault, setFault] = useState<unknown>(null);
  const [density, setDensity] = useState<CoverageDensity>("comfortable");
  const [offline, setOffline] = useState(false);

  // The frame states the reader's row height and whether the product is reachable; both are facts of
  // the browser, so they are read after mount and never guessed on the server (R-UI-005, I-89).
  useEffect(() => {
    const stated = document.querySelector("[data-density]")?.getAttribute("data-density");
    if (stated === "compact" || stated === "comfortable") setDensity(stated);
  }, []);

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

  // A retry that answers a refusal renders it in place through the one RefusalState, and a retry that
  // faults again is raised to the boundary that mints the next report id: a press that returns with
  // nothing said is the silence R-UI-020 forbids (ARCH-03, B-21).
  const retry = useCallback((): void => {
    void readCoverage(projectId)
      .then((answer) => {
        if (answer.ok) {
          setRefused(null);
          setHeld(answer.answer);
          return;
        }
        if (refusalOf(answer.refusal) === undefined) throw Object.assign(new Error(answer.refusal), { refusalCode: answer.refusal });
        setRefused(answer.refusal);
      })
      .catch((thrown: unknown) => setFault(() => thrown));
  }, [projectId]);

  // Thrown in render, where React's own boundary is: a rejected promise reaches no boundary at all.
  if (fault !== null) throw fault;

  const doors: CoverageDoors = {
    previewHoldOutOfBill: async ({ input }: { input: BoundaryCell }): Promise<CoveragePreviewAnswer> =>
      previewed(carried(await previewHoldOutOfBill(ask(HOLD_OUT_OF_BILL, input)))),
    commitHoldOutOfBill: async ({ input, consequenceDigest }: { input: BoundaryCell; consequenceDigest: string }) =>
      carried(await commitHoldOutOfBill(ask(HOLD_OUT_OF_BILL, input), consequenceDigest)),
    previewDeclareNotInProjectScope: async ({ input }: { input: BoundaryCell }): Promise<CoveragePreviewAnswer> =>
      previewed(carried(await previewDeclareNotInProjectScope(ask(DECLARE_NOT_IN_PROJECT_SCOPE, input)))),
    commitDeclareNotInProjectScope: async ({ input, consequenceDigest }: { input: BoundaryCell; consequenceDigest: string }) =>
      carried(await commitDeclareNotInProjectScope(ask(DECLARE_NOT_IN_PROJECT_SCOPE, input), consequenceDigest)),
    retry,
    refusalOf,
  };

  return (
    <CoverageWorkspace
      view={held}
      density={density}
      permitted={permitted}
      offline={offline}
      reportId={reportId}
      refused={refused}
      cell={initialCell}
      chrome={CHROME}
      doors={doors}
    />
  );
}
