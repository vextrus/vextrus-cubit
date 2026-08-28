"use client";
// R-UI-033's first screen: a workspace with no projects teaches the next action and offers the
// SAMPLE set on one click. The offer stays enabled after an answer — a retry is never disarmed —
// and an absence is stated as a notice, deliberately not as a refusal: nothing was denied.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../../../../ui/primitives/core";
import { ShellEmptyState, useFailureHandOff } from "../../../../ui/shell";
import { strings } from "../../../../ui/strings";
import { offerSampleAction } from "./actions";

export function ProjectsOnboarding() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [unavailable, setUnavailable] = useState(false);
  // A failed offer is a failure, not a silence: closing over a discarded promise would leave the
  // button simply stopping being busy with nothing said (ARCH-03, B-21) — the same defect the top
  // bar's sign-out had, answered by the same hand-off (src/ui/shell/failure-hand-off.ts), which
  // re-throws to this screen's `error` home. An answer of `{ available: false }` is not a failure:
  // that is a stated absence, and it is rendered as the notice below.
  const handing = useFailureHandOff();

  const offer = (): void => {
    if (pending) return;
    start(() =>
      handing(async () => {
        const answer = await offerSampleAction();
        // Seeded, the answer is a place to go, so the screen goes there; unseeded, it is a sentence.
        if ("seeded" in answer) router.push(answer.goTo);
        else setUnavailable(true);
      }),
    );
  };

  return (
    <ShellEmptyState
      heading={strings.shell_projects_empty_heading}
      body={strings.shell_projects_empty_body}
      answer={
        // The live region is mounted from the first paint and observed empty, so the answer is an
        // insertion into a region assistive technology is already watching (Q-11). A region that
        // arrives with its text already in it is unreliably announced — and it is the wrapper that
        // waits, never the notice, so nothing is painted until there is something to read.
        <div className="cx-shell-live" aria-live="polite">
          {unavailable ? (
            <div className="cx-shell-outcome cx-shell-notice" data-testid="shell-sample-outcome" role="status">
              {strings.shell_sample_unavailable}
            </div>
          ) : null}
        </div>
      }
    >
      <Button data-testid="shell-sample-offer" loading={pending} onClick={offer}>
        {strings.shell_sample_offer}
      </Button>
    </ShellEmptyState>
  );
}
