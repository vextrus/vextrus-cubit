/**
 * §3's refusal, read off a screen's query (docs/design/s-auth.md §3, §13).
 *
 * One rule for the three screens a spent link can land on, because the rule is one thing:
 * `?error=link-expired` — the exact value the Design Decision names — renders the
 * `AUTH_LINK_EXPIRED` block, and an arrival carrying this product's own callback mark is
 * rewritten to that query first (better-auth stamps its own code on the URL it was handed,
 * so the mark is what survives). Anything else in `error` is somebody's guess at a URL, not
 * a link this product minted, and the screen answers it with its plain form.
 */
import { LINK_EXPIRED, LINK_REFUSAL_VALUE, VERIFY_CALLBACK_PARAM } from '../../server/auth-policy';

export type AuthQuery = Record<string, string | string[] | undefined>;

/** What §3 asks of this arrival: render the refusal, and/or land on the documented URL. */
export interface LinkRefusal {
  readonly refused: boolean;
  /** The `?error=link-expired` URL to redirect to first, when this arrival is not on it. */
  readonly canonical: string | null;
}

/** A repeated query param arrives as an array; the first value is the one that was meant. */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function linkRefusal(query: AuthQuery, screen: string): LinkRefusal {
  if (one(query['error']) === LINK_EXPIRED) return { refused: true, canonical: null };
  if (one(query[VERIFY_CALLBACK_PARAM]) === LINK_REFUSAL_VALUE) {
    return { refused: true, canonical: `${screen}?error=${LINK_EXPIRED}` };
  }
  return { refused: false, canonical: null };
}
