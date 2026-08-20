import { ShieldAlert } from 'lucide-react';
import type { RefusalCode } from '../../core/errors';
import { REFUSALS } from '../../core/errors';
import { strings } from '../strings/common';

/**
 * R-UI-020 — a refusal is never a toast alone. It renders in place with its
 * code, its message, its remedy and, where there is one, a link to the evidence
 * or setting that resolves it. Silence never happens: a surface that cannot
 * proceed says why, by name.
 */
export interface RefusalStateProps {
  code: RefusalCode;
  /** Overrides the registered message when the call site knows something sharper. */
  detail?: string;
  remedyHref?: string;
  remedyLabel?: string;
}

export function RefusalState({ code, detail, remedyHref, remedyLabel }: RefusalStateProps) {
  const entry = REFUSALS[code];

  return (
    <div className="refusal" data-testid="refusal-state" role="alert">
      <div className="refusal-head">
        <ShieldAlert aria-hidden="true" size={16} />
        <span className="visually-hidden">{strings.refusalCodeLabel}</span>
        <span className="refusal-code" data-testid="refusal-code">
          {code}
        </span>
      </div>
      <p className="refusal-message" data-testid="refusal-message">
        {detail ?? entry.message}
      </p>
      <p className="refusal-remedy" data-testid="refusal-remedy">
        {entry.remedy}
      </p>
      {remedyHref === undefined || remedyLabel === undefined ? null : (
        <a className="refusal-link" href={remedyHref}>
          {remedyLabel}
        </a>
      )}
    </div>
  );
}
