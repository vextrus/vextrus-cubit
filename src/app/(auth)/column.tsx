"use client";
// The parts of the auth column that answer to what the body is currently showing (Decision § 1):
// the heading above the body, and the footer links below it. Both outlive the form between them, and
// both are false when they go on describing a screen that has moved on, so they are one client
// island with the body passed through as children.
//
// A door whose work is finished replaces the form with its notice, and until now the `<h1>` above
// that notice went on saying what the person had come to do: "Create your account" over "Check your
// email — we sent you a verification link." A heading names what is on the screen, so a heading that
// names something no longer there is false, and it is the first line a screen reader reaches
// (R-UI-050 — the settled leg is a state of the screen, not of the form alone).
//
// The footer answers to the body in the other direction: a refusal states its own remedy, which is a
// link to the place the refusal is resolved (R-UI-020, Decision § 3), and a footer line offering
// that same place a second time is two controls, one destination, stacked — the person has to read
// both to find out they are one. So a line the answer on screen already offers stands down while it
// is offered, and comes back when the answer goes.
//
// The form is a client island below a server-rendered heading, so the three are joined by the one
// thing that crosses that boundary downward: these contexts. Outside a provider both are no-ops,
// which is exactly what the jsdom acceptance renders — a form on its own, with no column around it.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { strings, type StringKey } from "../../ui/strings";
import { FooterLines, type FooterLine } from "./footer";

/** Told what the finished screen is called; ignored where there is no heading to rename. */
export type DoneTitleSetter = (title: StringKey) => void;

const DoneTitle = createContext<DoneTitleSetter>(() => {});

/** How a settled form or panel renames the heading above it. */
export function useDoneTitle(): DoneTitleSetter {
  return useContext(DoneTitle);
}

/** Told which place the body's current answer already offers, or `null` while it offers none. */
export type PlaceOfferedSetter = (href: string | null) => void;

const PlaceOffered = createContext<PlaceOfferedSetter>(() => {});

/**
 * How the answer in the body tells the column which place it already sends people to, so the footer
 * does not send them there again. Reported for exactly as long as the answer is mounted: when it is
 * replaced — by a retry, or by the next answer — the line the footer stood down comes back.
 */
export function useOffersPlace(href: string | null): void {
  const report = useContext(PlaceOffered);
  useEffect(() => {
    report(href);
    return () => report(null);
  }, [href, report]);
}

export interface AuthColumnProps {
  title: StringKey;
  caption?: StringKey;
  titleId: string;
  footer?: readonly FooterLine[];
  children: ReactNode;
}

/** One `<h1>` saying what the screen is showing right now, the body, and the footer under both. */
export function AuthColumn({ title, caption, titleId, footer = [], children }: AuthColumnProps) {
  const [done, setDone] = useState<StringKey | null>(null);
  const [offered, setOffered] = useState<string | null>(null);
  return (
    <DoneTitle.Provider value={setDone}>
      <PlaceOffered.Provider value={setOffered}>
        <h1 className="cx-auth-title" id={titleId}>
          {strings[done ?? title]}
        </h1>
        {caption === undefined ? null : <p className="cx-auth-caption">{strings[caption]}</p>}
        {children}
        <FooterLines lines={footer.filter((line) => line.href !== offered)} />
      </PlaceOffered.Provider>
    </DoneTitle.Provider>
  );
}
