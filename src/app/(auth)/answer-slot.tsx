// The answer slot (Decision § 1): exactly one of a refusal, a fault or a notice sits between the
// last field and the submit, so the answer to the previous attempt reads before the retry.
//
// R-SPINE-007's two answers never share a surface. A refusal is rendered by the one RefusalState
// (R-UI-020, B-17) — this file adds the wrapper the test contract names and no chrome of its own —
// and a fault is the machine's failure, dressed in graphite because it carries no meaning colour.
import { RefusalState } from "../../ui/patterns/refusal-state";
import { strings } from "../../ui/strings";
import { evidenceFor, type Answer } from "./answers";
import type { AuthRoute } from "./routes";

/** A registered refusal, in place, with the link to where it is resolved. */
export function RefusalSlot({ answer, route }: { answer: Extract<Answer, { kind: "refusal" }>; route: AuthRoute }) {
  return (
    <div className="cx-auth-answer" data-testid="s-auth-refusal">
      <RefusalState refusal={answer.refusal} evidence={evidenceFor(answer.refusal.code, route)} />
    </div>
  );
}

/**
 * The distinct answer R-SPINE-007 demands. A fault that reached the screen with an id quotes it, so
 * a person can hand the operator the one string that finds the record; a failure that never reached
 * the server has no id to quote and says so instead (Decision I-12) — never silence, and never an
 * impersonated refusal.
 */
export function FaultSlot({ faultId }: { faultId: string | null }) {
  return (
    <div className="cx-auth-fault" data-testid="s-auth-fault" role="alert">
      <p className="cx-auth-fault-title">{strings.auth_fault_title}</p>
      <p className="cx-auth-fault-body">{faultId === null ? strings.auth_fault_unreachable_body : strings.auth_fault_body}</p>
      {faultId === null ? null : (
        <p className="cx-auth-fault-id">
          <span>{strings.auth_fault_id_label}</span>
          <span>{faultId}</span>
        </p>
      )}
    </div>
  );
}

/** The outcome notice: what happened, said once, where the answer was expected. */
export function NoticeSlot({ message }: { message: string }) {
  return (
    <div className="cx-auth-notice" data-testid="s-auth-notice" role="status">
      {message}
    </div>
  );
}

/** Whichever answer this settlement was, or nothing at all while there has been no attempt. */
export function AnswerSlot({ answer, route }: { answer: Answer | null; route: AuthRoute }) {
  if (answer === null) return null;
  if (answer.kind === "refusal") return <RefusalSlot answer={answer} route={route} />;
  return <FaultSlot faultId={answer.faultId} />;
}
