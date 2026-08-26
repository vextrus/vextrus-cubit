"use client";
// The heading, and the one thing on the auth column that outlives the form under it (Decision § 1).
//
// A door whose work is finished replaces the form with its notice, and until now the `<h1>` above
// that notice went on saying what the person had come to do: "Create your account" over "Check your
// email — we sent you a verification link." A heading names what is on the screen, so a heading that
// names something no longer there is false, and it is the first line a screen reader reaches
// (R-UI-050 — the settled leg is a state of the screen, not of the form alone).
//
// The form is a client island below a server-rendered heading, so the two are joined by the one
// thing that crosses that boundary downward: this context. Outside a provider the setter is a no-op,
// which is exactly what the jsdom acceptance renders — a form on its own, with no column around it.
import { createContext, useContext, useState, type ReactNode } from "react";
import { strings, type StringKey } from "../../ui/strings";

/** Told what the finished screen is called; ignored where there is no heading to rename. */
export type DoneTitleSetter = (title: StringKey) => void;

const DoneTitle = createContext<DoneTitleSetter>(() => {});

/** How a settled form or panel renames the heading above it. */
export function useDoneTitle(): DoneTitleSetter {
  return useContext(DoneTitle);
}

export interface AuthHeadingProps {
  title: StringKey;
  caption?: StringKey;
  titleId: string;
  children: ReactNode;
}

/** The heading and the body under it: one `<h1>`, saying what the screen is showing right now. */
export function AuthHeading({ title, caption, titleId, children }: AuthHeadingProps) {
  const [done, setDone] = useState<StringKey | null>(null);
  return (
    <DoneTitle.Provider value={setDone}>
      <h1 className="cx-auth-title" id={titleId}>
        {strings[done ?? title]}
      </h1>
      {caption === undefined ? null : <p className="cx-auth-caption">{strings[caption]}</p>}
      {children}
    </DoneTitle.Provider>
  );
}
