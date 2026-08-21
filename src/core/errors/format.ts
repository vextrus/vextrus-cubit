/**
 * The format module's refusals — the two ways SEAM-FORMAT declines to render (L-FMT-02).
 *
 * "The formatter does not round; it refuses a value not rounded to the stated per-kind
 * precision (`PRECISION_NOT_APPLIED`) … a character the pinned font lacks refuses
 * (`CHARACTER_NOT_COVERED`)." Both are the seam refusing to make a decision the caller owes
 * it: rounding is an accounting decision and a substituted glyph is a document nobody can
 * read back. Registering them here closes the taxonomy over the literals `src/core/format.ts`
 * spells, exactly as the spine registry does for the database seam's two.
 *
 * Both bite on a field: the value that cannot be rendered is one a person typed or a column
 * holds, so the reader who can fix it is looking at that field — not at a toast, and not at a
 * log line nobody reads.
 */
import { registry } from './types';

export const FORMAT_REFUSALS = registry({
  PRECISION_NOT_APPLIED: {
    code: 'PRECISION_NOT_APPLIED',
    message: 'The value handed to the formatter is not written at its kind’s stated precision.',
    remedy: 'Round the value to the kind’s precision before rendering it — the seam never will.',
    severity: 'block',
    surface: 'field',
  },
  CHARACTER_NOT_COVERED: {
    code: 'CHARACTER_NOT_COVERED',
    message: 'The text carries a character outside the coverage the document’s font is pinned to.',
    remedy: 'Write the text in printable ASCII or Bangla, or have the character added to the set.',
    severity: 'block',
    surface: 'field',
  },
});
