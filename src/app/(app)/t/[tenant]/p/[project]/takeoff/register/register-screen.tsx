"use client";
// The register workspace, bound (docs/design/s-takeoff.md I-170). This is the one file that may
// reach both `src/ui` and `src/modules`: it hands the presentational workspace the nine SHIPPED
// renderers and the lane's own doors, and adds nothing of its own to either.
//
// It also holds the two cells the workspace cannot hold, because both are about the read rather than
// about the register: the fault the read left behind, with the report id and the retry R-UI-050 asks
// for, and the reading itself once a retry has answered.
import { useCallback, useEffect, useState } from "react";
import type { Consequence, CorroborateInput, InsertLevelInput, RepudiateInput } from "@/core/acts";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { RegisterWorkspace, type RegisterChrome, type RegisterDensity, type RegisterDoors, type PreviewAnswer } from "@/modules/takeoff/register-ui";
import type { RegisterView } from "@/modules/takeoff/register-ui/view";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { JobTimeline } from "@/ui/patterns/job-timeline";
import { OfferedGroups } from "@/ui/patterns/offered-group";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { BasisChip, Button, CoverageChip, Skeleton } from "@/ui/primitives/core";
import { DataTable, Tree } from "@/ui/primitives/data";
import { strings } from "@/ui/strings";
import { commitCorroborate, commitInsertLevel, commitRepudiate, previewCorroborate, previewInsertLevel, previewRepudiate, readRegister, requestMeasure, type DoorAnswer } from "./actions";

/** The nine shipped renderers, bound once (I-170): what a test mounts is what this route renders. */
const CHROME: RegisterChrome = {
  Tree,
  DataTable,
  RefusalState,
  OfferedGroups,
  ConsequenceDialog,
  JobTimeline,
  Skeleton,
  BasisChip,
  CoverageChip,
};

/** A door's answer, as the workspace reads one: the value, or the refusal it re-raises in place. */
function carried<T>(answer: DoorAnswer<T>): T {
  if (answer.ok) return answer.answer;
  throw Object.assign(new Error(answer.refusal), { refusalCode: answer.refusal });
}

/** The registry, read through its one home — this screen re-words no code (R-UI-020, ARCH-02). */
const refusalOf = (code: string): RefusalEntry | undefined => (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];

/** A preview the lane answered, typed as the dialog reads one — the Consequence is the seam's. */
const previewed = (answer: { consequence: unknown; consequenceDigest: string }): PreviewAnswer => ({
  consequence: answer.consequence as Consequence,
  consequenceDigest: answer.consequenceDigest,
});

export interface RegisterScreenProps {
  readonly view: RegisterView | null;
  readonly projectId: string;
  readonly permitted: boolean;
  /** The fault the read left behind, quoted verbatim where the register could not be read (B-21). */
  readonly reportId: string | null;
}

export function RegisterScreen({ view, projectId, permitted, reportId }: RegisterScreenProps) {
  const [held, setHeld] = useState<RegisterView | null>(view);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");
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

  const retry = useCallback((): void => {
    void readRegister(projectId).then((answer) => {
      if (answer.ok) setHeld(answer.answer);
    });
  }, [projectId]);

  const doors: RegisterDoors = {
    previewCorroborate: async ({ input }: { input: CorroborateInput }) => previewed(carried(await previewCorroborate(input))),
    commitCorroborate: async ({ input, consequenceDigest }: { input: CorroborateInput; consequenceDigest: string }) => carried(await commitCorroborate(input, consequenceDigest)),
    previewRepudiate: async ({ input }: { input: RepudiateInput }) => previewed(carried(await previewRepudiate(input))),
    commitRepudiate: async ({ input, consequenceDigest }: { input: RepudiateInput; consequenceDigest: string }) => carried(await commitRepudiate(input, consequenceDigest)),
    previewInsertLevel: async ({ input }: { input: InsertLevelInput }) => previewed(carried(await previewInsertLevel(input))),
    commitInsertLevel: async ({ input, consequenceDigest }: { input: InsertLevelInput; consequenceDigest: string }) => carried(await commitInsertLevel(input, consequenceDigest)),
    requestMeasure: async ({ projectId: asked, campaignId }: { projectId: string; campaignId: string }) => carried(await requestMeasure(asked, campaignId)),
    refusalOf,
  };

  // R-UI-050's error cell: the read failed, nothing was changed, and the report id a person quotes
  // stands beside the one door that can clear it.
  if (held === null) {
    return (
      <div className="cx-register" data-testid="register-workspace" data-state="error">
        <div className="cx-register-empty" data-testid="register-empty">
          <h1 className="cx-register-empty-heading">{strings.takeoff_register_error_heading}</h1>
          <p className="cx-register-empty-body">{strings.takeoff_register_error_body}</p>
          <p className="cx-register-report">
            <span className="cx-register-report-label">{strings.takeoff_register_report_label}</span>
            <span className="cx-register-report-id">{reportId ?? ""}</span>
          </p>
          <Button variant="secondary" data-testid="register-retry" onClick={retry}>
            {strings.takeoff_register_retry}
          </Button>
        </div>
      </div>
    );
  }

  return <RegisterWorkspace view={held} density={density} permitted={permitted} offline={offline} chrome={CHROME} doors={doors} />;
}
