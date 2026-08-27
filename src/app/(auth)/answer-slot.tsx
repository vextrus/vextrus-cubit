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
 * the server says so instead (Decision I-12) — never silence, and never an impersonated refusal.
 *
 * Which body reads is decided by whether the server answered, not by whether an id came back: a
 * reply the transport could not read as an envelope reached the screen with no id, and the
 * unreachable body would tell that person to check a connection that plainly worked. It gets the
 * recorded-fault body without the id line — there is no id, and inventing one would be worse.
 */
export function FaultSlot({ faultId, reached }: { faultId: string | null; reached: boolean }) {
  return (
    <div className="cx-auth-fault" data-testid="s-auth-fault" role="alert">
      <p className="cx-auth-fault-title">{strings.auth_fault_title}</p>
      <p className="cx-auth-fault-body">{reached ? strings.auth_fault_body : strings.auth_fault_unreachable_body}</p>
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
  return <FaultSlot faultId={answer.faultId} reached={answer.reached} />;
}
