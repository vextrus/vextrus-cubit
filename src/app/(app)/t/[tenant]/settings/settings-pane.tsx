// The settings TEMPLATE (Design Direction 00 §3.6): a 160 px section nav and a content pane whose
// primary is a table. Every settings screen in the product — the workspace's General and Members,
// the project's Participants and Rule set — is drawn in this frame, so the nav, the 40 px header
// and the `(i)` disclosure have one home rather than four (B-17).
//
// The nav is a list of AREAS, and an area a reader can see is either a place or a promise: an area
// with a screen is a `next/link` that travels through the router, and one without is shown
// disabled with the reason in a tooltip (§3.6's "disabled with tooltip instead of inline text").
// Nothing here is hidden by a role — what a person may do is the server's answer, in place.
//
// No hook and no state: the pane is rendered by server components and by client ones alike, so it
// holds neither. The active area arrives as a key, because a layout that read the address would be
// a second home for what the route already says (R-UI-031).
import "./settings.css";

import Link from "next/link";
import type { ReactNode } from "react";
import { IconInfo } from "@/ui/icons";
import { Tooltip } from "@/ui/primitives/core";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/primitives/overlay";
import { shellHref } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { membersRoute } from "./members/route-address";
import { membersStrings } from "./members/strings";
import { settingsStrings } from "./strings";

/** One row of the section nav: the area, the words it is read by, and where it stands — or nowhere. */
export interface SettingsNavItem {
  readonly key: string;
  readonly label: string;
  /** The address the area answers at, or null while no screen of this tree answers for it. */
  readonly href: string | null;
  /** The id the contract fixes for this row, where one is fixed (C-05). */
  readonly testId?: string;
}

/**
 * The workspace's settings areas, in §3.6's own order. Books is the workspace's Books area — a real
 * location the shell already names — and the last three are promises the nav keeps visible.
 */
export function workspaceSettingsNav(tenantId: string): readonly SettingsNavItem[] {
  return [
    { key: "general", label: settingsStrings.settings_nav_general, href: `/t/${tenantId}/settings` },
    { key: "members", label: membersStrings.members_heading, href: membersRoute(tenantId), testId: "settings-members-link" },
    { key: "books", label: strings.shell_nav_books, href: shellHref(tenantId, "books") },
    { key: "ruleset", label: settingsStrings.settings_nav_ruleset, href: null },
    { key: "taxonomy", label: settingsStrings.settings_nav_taxonomy, href: null },
    { key: "tax", label: settingsStrings.settings_nav_tax, href: null },
  ];
}

export interface SettingsPaneProps {
  items: readonly SettingsNavItem[];
  /** The area the reader is standing in — the row that carries `aria-current` (R-UI-031). */
  active: string;
  /** What this set of areas is announced as; unset, it is the workspace's own settings nav. */
  label?: string;
  children: ReactNode;
}

export function SettingsPane({ items, active, label = settingsStrings.settings_nav_label, children }: SettingsPaneProps) {
  return (
    <div className="cx-settings">
      <nav className="cx-settings-nav" aria-label={label}>
        <ul className="cx-settings-nav-list">
          {items.map((item) => (
            <li className="cx-settings-nav-row" key={item.key}>
              {item.href === null ? (
                // A promise, not a control: it takes no tab stop and no pointer, and the tooltip
                // says why it does nothing rather than a sentence standing in the pane forever.
                <Tooltip content={settingsStrings.settings_nav_unbuilt}>
                  {/* A promise wears the row's own id and key exactly as a place does: availability
                      is read off the ADDRESS (the element is no anchor, and it says
                      `data-unbuilt`), never off whether the row is in the document at all. */}
                  <span className="cx-settings-nav-item" data-testid={item.testId} data-area={item.key} data-unbuilt="true" aria-disabled="true">
                    {item.label}
                  </span>
                </Tooltip>
              ) : (
                <Link
                  className="cx-settings-nav-item cx-reticle"
                  data-testid={item.testId}
                  data-area={item.key}
                  href={item.href}
                  aria-current={item.key === active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="cx-settings-content">{children}</div>
    </div>
  );
}

export interface SettingsHeaderProps {
  title: string;
  /** The sentence this screen would have worn as a subtitle — §6 puts it behind the `(i)` instead. */
  about?: string | readonly string[];
  children?: ReactNode;
}

/** The 40 px header: the title, the `(i)` that holds what a subtitle used to say, then the controls. */
export function SettingsHeader({ title, about, children }: SettingsHeaderProps) {
  return (
    <header className="cx-settings-header">
      <h1 className="cx-settings-title">{title}</h1>
      {about === undefined ? null : <SettingsAbout body={about} />}
      {children === undefined ? null : <div className="cx-settings-header-end">{children}</div>}
    </header>
  );
}

export interface SettingsAboutProps {
  /** The sentences the disclosure holds, in the order they are read. */
  body: string | readonly string[];
  /** What the disclosure is announced as, where a screen names it better than "about this screen". */
  label?: string;
}

/**
 * §6's `(i)`: the helper prose a screen used to print under its heading, one press away. The
 * trigger is the shipped ghost Button with a 14 px glyph; the content is the shipped Popover, which
 * portals, so a table's `overflow` cannot clip it.
 */
export function SettingsAbout({ body, label = settingsStrings.settings_about_label }: SettingsAboutProps) {
  return (
    <Popover>
      <PopoverTrigger className="cx-settings-about" aria-label={label}>
        <IconInfo size="sm" />
      </PopoverTrigger>
      <PopoverContent className="cx-settings-about-body" aria-label={label}>
        {(typeof body === "string" ? [body] : body).map((line) => (
          <p className="cx-settings-about-line" key={line}>
            {line}
          </p>
        ))}
      </PopoverContent>
    </Popover>
  );
}
