"use client";
// The panel behind a mailed link (Decision § 2): there is nothing to fill in, so the token is spent
// on mount and the answer is whatever came back.
//
// R-UI-050's loading leg for this shape is a Skeleton that keeps the layout, never a spinner. The
// token is spent exactly once per mounted panel: a link is single-use, so a second attempt on the
// same token would answer TOKEN_NOT_VALID and tell the person their live link is dead.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "../../ui/primitives/core";
import { strings, type StringKey } from "../../ui/strings";
import { AnswerSlot, NoticeSlot } from "./answer-slot";
import { settle, type Answer } from "./answers";
import type { AuthRoute } from "./routes";
import { useDoneTitle } from "./title";
import { mutate, type AuthProcedure } from "./transport";

/** What spending the token achieved: a stated outcome, or the session it just started. */
export type TokenOutcome = { notice: StringKey; title: StringKey } | { goTo: string };

export interface TokenPanelProps {
  route: AuthRoute;
  token: string;
  procedure: AuthProcedure;
  outcome: TokenOutcome;
}

export function TokenPanel({ route, token, procedure, outcome }: TokenPanelProps) {
  const router = useRouter();
  const setDoneTitle = useDoneTitle();
  const spent = useRef<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (spent.current === token) return;
    spent.current = token;
    void settle(mutate(procedure, { token })).then((settled) => {
      if (!settled.ok) {
        setAnswer(settled.answer);
        return;
      }
      if ("goTo" in outcome) router.push(outcome.goTo);
      else {
        setDone(true);
        setDoneTitle(outcome.title);
      }
    });
  }, [outcome, procedure, router, setDoneTitle, token]);

  if (answer !== null) return <AnswerSlot answer={answer} route={route} />;
  if (done && "notice" in outcome) return <NoticeSlot message={strings[outcome.notice]} />;
  return <Skeleton className="cx-auth-panel-skeleton" />;
}
