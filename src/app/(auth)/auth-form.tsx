"use client";
// The one form every S-Auth door is asked through (Decision § 1, B-17): fields stacked over the
// answer slot over a full-width submit, submitted natively so Enter submits.
//
// Decision I-13: no screen invents a credential rule. The closed taxonomy registers no code for a
// weak password or a malformed address, so the fields submit as entered and the server's answer —
// a registered refusal or a fault — is the only judge. Every field a door takes is one the door
// requires, so each input carries the browser's own `required`: that invents no rule and no copy —
// it only keeps the browser from sending a form the person has not filled in. Without it a blank
// submit reaches the door's input reader, comes back unmarked, and is reported as a fault, which
// tells the person the machine broke and files an operator record for an empty box (R-SPINE-007,
// ARCH-03). While a submit is in flight the fields are
// disabled and the submit takes the core loading state; on any answer the form re-enables with its
// values intact, rate limits included, because the remedy says when to retry and the screen never
// disarms the retry.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Input } from "../../ui/primitives/core";
import { fill, strings, type StringKey } from "../../ui/strings";
import { AnswerSlot, NoticeSlot } from "./answer-slot";
import { settle, type Answer } from "./answers";
import { FooterLines, type FooterLine } from "./footer";
import type { AuthRoute } from "./routes";
import { useDoneTitle } from "./title";

/** One field of a door: what it is called, what it is for, and what the browser should offer. */
export interface AuthField {
  name: string;
  testId: string;
  label: StringKey;
  autoComplete: string;
  type?: "text" | "email" | "password";
  hint?: StringKey;
}

/**
 * What success means here. A door whose work is finished says so in a notice that replaces the form
 * — nothing is left to submit, and re-submitting would only invite a rate limit — while a door that
 * has signed the person in sends them where they were going. A door that finishes on the screen also
 * names what the screen has become: the notice is the body of a different state, and the heading
 * above it says so rather than going on naming the form that is no longer there.
 *
 * The notice reads through the string seam's `fill`, with the submitted fields as its slots: a
 * notice that names the address the mail went to (`{email}`) is a notice a person who mistyped can
 * catch, and a notice whose door takes no such field is left exactly as it is written.
 */
export type AuthSuccess = { notice: StringKey; title: StringKey; then?: FooterLine } | { goTo: string };

export interface AuthFormProps {
  route: AuthRoute;
  fields: readonly AuthField[];
  submit: StringKey;
  perform: (values: Readonly<Record<string, string>>) => Promise<unknown>;
  success: AuthSuccess;
  /** The query this screen was reached with, where it has one — a mailed link's token (R-UI-020). */
  search?: string;
}

export function AuthForm({ route, fields, submit, perform, success, search }: AuthFormProps) {
  const router = useRouter();
  const setDoneTitle = useDoneTitle();
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [done, setDone] = useState(false);
  // What the finished door was given, kept so the notice it leaves can name it back.
  const [submitted, setSubmitted] = useState<Readonly<Record<string, string>>>({});

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const entered = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of fields) values[field.name] = String(entered.get(field.name) ?? "");

    setBusy(true);
    setAnswer(null);
    void settle(perform(values)).then((settled) => {
      setBusy(false);
      if (!settled.ok) {
        setAnswer(settled.answer);
        return;
      }
      if ("goTo" in success) router.push(success.goTo);
      else {
        setSubmitted(values);
        setDone(true);
        setDoneTitle(success.title);
      }
    });
  };

  if (done && "notice" in success) {
    return (
      <>
        <NoticeSlot message={fill(strings[success.notice], submitted)} />
        <FooterLines lines={success.then === undefined ? [] : [success.then]} />
      </>
    );
  }

  return (
    <form className="cx-auth-body" onSubmit={onSubmit}>
      {fields.map((field) => (
        <div className="cx-auth-field" key={field.name}>
          <label htmlFor={field.testId}>{strings[field.label]}</label>
          {field.hint === undefined ? null : (
            <p className="cx-auth-hint" id={`${field.testId}-hint`}>
              {strings[field.hint]}
            </p>
          )}
          <Input
            id={field.testId}
            name={field.name}
            data-testid={field.testId}
            type={field.type ?? "text"}
            autoComplete={field.autoComplete}
            aria-describedby={field.hint === undefined ? undefined : `${field.testId}-hint`}
            required
            disabled={busy}
          />
        </div>
      ))}
      <AnswerSlot answer={answer} route={route} search={search} />
      <Button className="cx-auth-submit" type="submit" data-testid="s-auth-submit" variant="primary" loading={busy}>
        {strings[submit]}
      </Button>
    </form>
  );
}
