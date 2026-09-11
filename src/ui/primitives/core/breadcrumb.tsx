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
import { useEffect, useRef, useState, type JSX } from "react";
import { cx } from "./class-names";
import { IconChevronDown, IconChevronRight } from "../../icons";
import { strings } from "../../strings";

/** One place in the trail: what it is called, where it is, and what else sits at its level. */
export interface BreadcrumbCrumb {
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

  const last = crumbs.length - 1;

  /** Escape closes the open menu. It rides the CONTROLS — a `<nav>` is not a thing one types at. */
  const escapes = (event: { key: string }): void => {
    if (event.key === "Escape" && open !== null) setOpen(null);
  };

  return (
    <nav ref={root} className={cx("cx-breadcrumb", className)} aria-label={strings.primitive_breadcrumb_label} data-testid="breadcrumb">
      <ol className="cx-breadcrumb-list">
        {crumbs.map((crumb, at) => (
          <li className="cx-breadcrumb-item" key={crumb.id} data-testid="breadcrumb-crumb" data-crumb={crumb.id}>
            {at === 0 ? null : (
              <IconChevronRight size="sm" className="cx-breadcrumb-separator" />
            )}
            {crumb.href === undefined ? (
              <span className="cx-breadcrumb-label" aria-current={at === last ? "page" : undefined}>
                {crumb.label}
              </span>
            ) : (
              <a
                className="cx-breadcrumb-label cx-breadcrumb-link cx-reticle"
                href={crumb.href}
                aria-current={at === last ? "page" : undefined}
              >
                {crumb.label}
              </a>
            )}
            {crumb.menu === undefined || crumb.menu.length === 0 ? null : (
              <>
                <button
                  type="button"
                  className="cx-breadcrumb-disclosure cx-reticle"
                  data-testid="breadcrumb-menu"
                  data-crumb={crumb.id}
                  aria-label={strings.primitive_breadcrumb_menu}
                  aria-expanded={open === crumb.id}
                  onClick={() => setOpen((held) => (held === crumb.id ? null : crumb.id))}
                  onKeyDown={escapes}
                >
                  <IconChevronDown size="sm" />
                </button>
                {open === crumb.id ? (
                  <ul className="cx-breadcrumb-menu" data-testid="breadcrumb-menu-list">
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
        ))}
      </ol>
    </nav>
  );
}
