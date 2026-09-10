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
 * source key is text and R-UI-012 puts text at 4.5:1, which `--basis-defaulted` cannot clear in
 * light. This is BasisChip's own ruling applied unchanged, so the two surfaces of R-UI-002 agree.
 *
 * The glyph comes only from `BASIS_GLYPHS`, R-UI-002's single home, and is `aria-hidden`: it is the
 * colour's greyscale twin, not a second announcement. The accessible name stays the key itself.
 */
import type { ComponentPropsWithRef } from "react";
import { BASIS_GLYPHS, type Basis } from "../../primitives/core/basis";
import { strings } from "../../strings";

export type EvidenceLinkProps = {
  /** Where the evidence stands. The address is the consumer's — this layer composes none (I-178). */
  href: string;
  /** The basis the number was read on, which is the colour and the glyph it wears (R-UI-002). */
  basis: Basis;
  /** What a reader sees: the source key, whole and verbatim (I-26). */
  label: string;
} & ComponentPropsWithRef<"a">;

/**
 * The rest props are spread FIRST, so a caller may add `data-line`, `data-origin`, `aria-current`,
 * an `onClick` or a ref and may never re-id or re-class the element (Decision § 1).
 */
export function EvidenceLink({ href, basis, label, ...rest }: EvidenceLinkProps) {
  return (
    <a
      {...rest}
      className="cx-evidence-link cx-reticle"
      data-testid="evidence-link"
      data-basis={basis}
      href={href}
      title={strings.evidence_link_title}
    >
      <span className="cx-evidence-link-glyph" data-testid="evidence-link-glyph" aria-hidden="true">
        {BASIS_GLYPHS[basis]}
      </span>
      <span className="cx-evidence-link-label">{label}</span>
    </a>
  );
}
