/**
 * R-UI-022's Trace affordance, and its one home (B-17, ARCH-02): any number, cell or row that came
 * from a drawing carries one of these, and following it opens the sheet at the entities it was read
 * from.
 *
 * I-178 — the link is a place, never a door. It is a bare `<a href>`: it holds no state, opens
 * nothing itself, calls no router and knows nothing of the viewer, so activating it is a browser
 * navigation and Back is a real history step. Everything a consumer needs beyond that — the origin
 * stamp, `data-line`, `data-origin`, an `onClick` — arrives through the spread rest props and stays
 * the consumer's business. No address is composed here: a route's spelling may not live in `src/ui`.
 *
 * I-176 — the basis colours the glyph and the rule; the key itself reads in graphite, because a
 * source key is text and R-UI-012 puts text at 4.5:1, which the palest basis token cannot clear in
 * light. This is BasisChip's own ruling applied unchanged, so the two surfaces of R-UI-002 agree.
 *
 * The glyph comes only from `BASIS_GLYPHS`, R-UI-002's single home, and is `aria-hidden`: it is the
 * colour's greyscale twin, not a second announcement. The accessible name stays the key itself.
 *
 * I-554 — a link with no single basis. A sighting, a queue item, a storey-height note: each names
 * an entity of the drawing, and none is a figure read on one basis. Such a link states no basis at
 * all — no `data-basis`, no glyph, the rule in ink — because a colour or a mark borrowed from one
 * basis would say something about the evidence that nobody established (R-UI-002, R-UI-060).
 *
 * Inside a grid cell the link leaves the Tab order and is reached through its cell (Enter or F2):
 * a grid is one Tab stop, and a register's Source column was one stop per line (grid-cell.ts). A
 * consumer that states its own `tabIndex` keeps it; a screen that puts focus back on the link a
 * reader left (the register's origin, I-182) still can — out of the Tab order is not unfocusable.
 */
import type { ComponentPropsWithRef } from "react";
import { BASIS_GLYPHS, type Basis } from "../../primitives/core/basis";
import { cellControlTabIndex, useInGridCell } from "../../primitives/core/grid-cell";
import { strings } from "../../strings";
import { TESTIDS } from "@/ui/testids";

export type EvidenceLinkProps = {
  /** Where the evidence stands. The address is the consumer's — this layer composes none (I-178). */
  href: string;
  /**
   * The basis the number was read on, which is the colour and the glyph it wears (R-UI-002) — absent
   * where the link names an entity and no figure read on one basis (a sighting, I-554).
   */
  basis?: Basis;
  /** What a reader sees: the source key, whole and verbatim (I-26). */
  label: string;
} & ComponentPropsWithRef<"a">;

/**
 * The rest props are spread FIRST, so a caller may add `data-line`, `data-origin`, `aria-current`,
 * an `onClick` or a ref and may never re-id or re-class the element (Decision § 1).
 */
export function EvidenceLink({ href, basis, label, ...rest }: EvidenceLinkProps) {
  const cellTabIndex = cellControlTabIndex(useInGridCell());
  return (
    <a
      {...rest}
      tabIndex={rest.tabIndex ?? cellTabIndex}
      className="cx-evidence-link cx-reticle"
      data-testid={TESTIDS.evidence.link}
      data-basis={basis}
      href={href}
      title={strings.evidence_link_title}
    >
      {basis === undefined ? null : (
        <span className="cx-evidence-link-glyph" data-testid={TESTIDS.evidence.linkGlyph} aria-hidden="true">
          {BASIS_GLYPHS[basis]}
        </span>
      )}
      <span className="cx-evidence-link-label">{label}</span>
    </a>
  );
}
