"use client";
/**
 * Breadcrumb — `workspace › project ▾ › area › page` (Design Direction 00 §1, §3.1).
 *
 * Two laws shape it. First, **every crumb with an address is a real link** (R-UI-084, F-uiux §1.2:
 * "Workspace › Projects" that leads nowhere is the fault this replaces) — an anchor a browser can
 * follow, open in a tab and show in its status bar, never a click handler on a span. Second, it
 * **never wraps**: the top bar is 40 px and a crumb trail that grows a second line moves every
 * region under it. Labels ellipsise inside their own crumb instead.
 *
 * A crumb that carries `menu` wears a `▾` disclosure — the project switcher of the template — and
 * the menu is a list of links for the same reason the crumbs are.
 *
 * The crumb DATA is the caller's: the shell derives it from `src/ui/shell/routes.ts`, which is the
 * one home of the address→label mapping (B-17). This primitive decides nothing about what a place
 * is called; it decides how a trail is drawn.
 */
import { Fragment, useEffect, useRef, useState, type JSX } from "react";
import { cx } from "./class-names";
import { IconChevronDown, IconChevronRight } from "../../icons";
import { strings } from "../../strings";
import { TESTIDS } from "@/ui/testids";

/** One place in the trail: what it is called, where it is, and what else sits at its level. */
export interface BreadcrumbCrumb {
  /** True on the crumb that IS the page. Not "the last crumb": a trail may end at a step. */
  current?: boolean;
  /** The test id the shipped shell published on this crumb's `<li>` before the primitive existed. */
  testId?: string;
  id: string;
  label: string;
  href?: string;
  menu?: { id: string; label: string; href: string }[];
}

export function Breadcrumb(props: { crumbs: BreadcrumbCrumb[]; className?: string }): JSX.Element {
  const { crumbs, className } = props;
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open === null) return;
    const away = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);


  /** Escape closes the open menu. It rides the CONTROLS — a `<nav>` is not a thing one types at. */
  const escapes = (event: { key: string }): void => {
    if (event.key === "Escape" && open !== null) setOpen(null);
  };

  return (
    <nav ref={root} className={cx("cx-breadcrumb", className)} aria-label={strings.primitive_breadcrumb_label} data-testid={TESTIDS.breadcrumb.root}>
      <ol className="cx-breadcrumb-list">
        {crumbs.map((crumb, at) => (
          <Fragment key={crumb.id}>
          {at === 0 ? null : (
            // The separator is its OWN item, as the shell has drawn it since the frame shipped: a
            // chevron inside the crumb would make the trail read as one element to a screen reader
            // and would change the `li` count the frame's tests have always counted.
            <li className="cx-breadcrumb-separator cx-shell-crumb-separator" aria-hidden="true">
              <IconChevronRight size="sm" />
            </li>
          )}
          <li
            className={crumb.current === true ? "cx-breadcrumb-item cx-shell-crumb-current" : "cx-breadcrumb-item"}
            data-crumb={crumb.id}
            data-testid={crumb.testId ?? "breadcrumb-crumb"}
            aria-current={crumb.current === true ? "page" : undefined}
          >
            {crumb.href === undefined ? (
              <span className="cx-breadcrumb-label">{crumb.label}</span>
            ) : (
              <a className="cx-breadcrumb-label cx-breadcrumb-link cx-reticle" href={crumb.href}>
                {crumb.label}
              </a>
            )}
            {crumb.menu === undefined || crumb.menu.length === 0 ? null : (
              <>
                <button
                  type="button"
                  className="cx-breadcrumb-disclosure cx-reticle"
                  data-testid={TESTIDS.breadcrumb.menu}
                  data-crumb={crumb.id}
                  aria-label={strings.primitive_breadcrumb_menu}
                  aria-expanded={open === crumb.id}
                  onClick={() => setOpen((held) => (held === crumb.id ? null : crumb.id))}
                  onKeyDown={escapes}
                >
                  <IconChevronDown size="sm" />
                </button>
                {open === crumb.id ? (
                  <ul className="cx-breadcrumb-menu" data-testid={TESTIDS.breadcrumb.menuList}>
                    {crumb.menu.map((entry) => (
                      <li className="cx-breadcrumb-menu-item" key={entry.id}>
                        <a className="cx-breadcrumb-menu-link cx-reticle" href={entry.href} onKeyDown={escapes}>
                          {entry.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
