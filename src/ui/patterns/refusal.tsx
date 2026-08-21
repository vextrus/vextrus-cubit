/**
 * RefusalState and EvidenceLink (R-UI-020, R-UI-010).
 *
 * R-UI-020: "a refusal is never a toast alone; it renders in place with code, message, remedy
 * and a link to the evidence or setting that resolves it; silence never happens". So this
 * renders where it was mounted — in place of the content it refused — and it takes no message
 * or remedy prop at all. The prose belongs to the REFUSALS register (L-QTY-04: "reason codes
 * are closed enums, never prose"), and a component that accepted free text would be a second
 * place the same refusal could be worded differently.
 *
 * A code absent from the register throws, the way BasisMark throws on a basis outside the
 * seven: a plausible-looking refusal nobody registered must never reach a reader, because a
 * reader cannot tell it from a real one.
 *
 * Decided in docs/design/datum-patterns.md §8.
 */
import type { ReactElement, ReactNode } from 'react';
import { REFUSALS } from '../../core/errors';
import type { RefusalCode, RefusalEntry } from '../../core/errors';
import { cx } from '../primitives/class-names';
import { ps } from './strings';

export interface EvidenceLinkProps {
  /** Where the evidence or the setting that resolves this lives. */
  readonly href: string;
  /** The words on the link; without them it names itself (§8). */
  readonly children?: ReactNode;
}

export function EvidenceLink({ href, children }: EvidenceLinkProps): ReactElement {
  return (
    <a
      data-testid="evidence-link"
      href={href}
      className={cx('datum-evidence-link', 'datum-focus-ring')}
    >
      {children ?? ps('patterns.evidence.default')}
    </a>
  );
}

export interface RefusalStateProps {
  /** The registered code. Message and remedy come from the register, never from a caller. */
  readonly code: RefusalCode;
  /** The Trace affordance's target: the evidence or setting that resolves this refusal. */
  readonly evidenceHref: string;
  readonly evidenceLabel?: string;
}

export function RefusalState({
  code,
  evidenceHref,
  evidenceLabel,
}: RefusalStateProps): ReactElement {
  const entry: RefusalEntry | undefined = (REFUSALS as Readonly<Record<string, RefusalEntry>>)[
    code
  ];
  if (entry === undefined) throw new Error(`Unknown refusal code: ${code}`);

  return (
    <section data-testid="refusal-state" data-code={code} className="datum-refusal">
      {/* Deliberately not danger red (§8): a refusal is the system working, not broken. */}
      <p data-testid="refusal-code" className={cx('datum-refusal-code', 'numeric')}>
        {code}
      </p>
      <p data-testid="refusal-message" className="datum-refusal-message">
        {entry.message}
      </p>
      <p data-testid="refusal-remedy" className="datum-refusal-remedy">
        {entry.remedy}
      </p>
      <EvidenceLink href={evidenceHref}>{evidenceLabel}</EvidenceLink>
    </section>
  );
}
