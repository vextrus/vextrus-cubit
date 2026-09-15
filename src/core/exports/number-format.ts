// A-BOQ-XLSX's "lakh/crore number formats", as the one thing Excel understands: a number format code.
//
// L-FMT-01 puts the document's grouping in ONE home, and a spreadsheet is the awkward consumer of it
// — the figure is grouped inside Excel, by Excel, long after this process has ended, so the seam
// cannot hand over a formatted string and must hand over the RULE instead. That is the only reason a
// grouping code is written here at all, and it is why the code is DERIVED from `BD_DOCUMENT`'s own
// grouping rather than transcribed beside it: the sizes are read back off the format seam's answer
// for a probe figure, so a convention that ever changed would move this code with it and there is
// still exactly one grouping rule in the tree (B-17, B-07).
//
// What Excel needs and `en-IN` gives it are not the same shape. A plain `,` in a number format code
// groups every three digits, always; lakh/crore groups the last three and then twos. Excel has no
// code for that, so the format is written as a conditional one: a figure at or above a crore, one at
// or above a lakh, and everything below, each with the separators its own magnitude needs literally
// placed. The thresholds are the group sizes, not a second fact.
import { formatUserFigure } from "../format";

/** The figure the grouping is read off — wide enough to show the primary group and two secondaries. */
const PROBE = `1${"0".repeat(9)}`;

/** The separator the document convention groups with, and the escape Excel takes it literally under. */
const SEPARATOR = ",";
const LITERAL_SEPARATOR = "\\,";

/**
 * The document's grouping, as sizes: how many digits the last group holds and how many each group
 * above it holds. Read once, off the format seam's own answer — `1,00,00,00,000` says 3 and 2.
 */
const { primary, secondary } = groupSizes();

function groupSizes(): { primary: number; secondary: number } {
  const groups = formatUserFigure(PROBE).split(SEPARATOR);
  const primarySize = groups[groups.length - 1]?.length ?? 0;
  const secondarySize = groups[groups.length - 2]?.length ?? 0;
  if (primarySize === 0 || secondarySize === 0) {
    throw new Error("exports: the document convention groups no figure, so no Excel number format can be derived from it (L-FMT-01)");
  }
  return { primary: primarySize, secondary: secondarySize };
}

/**
 * How many magnitudes above the base the code states a section for. Two: a lakh and a crore, which
 * is exactly where `en-IN` grouping stops adding a rule and starts repeating one.
 */
const SECTIONS_ABOVE_BASE = 2;

/**
 * One section of the code: the digit placeholders and the separators a figure of that magnitude
 * needs. The base section separates with a real `,`, which is Excel's own three-digit grouping and
 * is right for everything below a lakh; every section above it places its separators literally,
 * because Excel would otherwise regroup them by threes.
 */
function section(above: number): string {
  const separator = above === 0 ? SEPARATOR : LITERAL_SEPARATOR;
  const upper = Array.from({ length: above + 1 }, () => "#".repeat(secondary));
  return [...upper, `${"#".repeat(primary - 1)}0`].join(separator);
}

/** The magnitude a section takes over at: one primary group, then one secondary per step above it. */
function threshold(above: number): string {
  return `1${"0".repeat(primary + above * secondary)}`;
}

/** The fraction Excel is told to show, or nothing at all where the kind carries no fraction. */
function fraction(fractionDigits: number): string {
  return fractionDigits === 0 ? "" : `.${"0".repeat(fractionDigits)}`;
}

/**
 * The Excel number format code for a figure at this precision, grouped as the document groups
 * (L-FMT-01, B-07). Every number and money cell an export writes carries one of these, and nothing
 * in the tree spells a grouping rule of its own beside it.
 *
 * A precision that is not a count of digits is a caller error, not a refusal: there is no figure
 * here for a person to correct, only a call that asked for a format that does not exist.
 */
export function lakhCroreNumberFormat(fractionDigits: number): string {
  if (!Number.isSafeInteger(fractionDigits) || fractionDigits < 0) {
    throw new TypeError("exports: fractionDigits must be a whole, non-negative count of digits");
  }
  const decimals = fraction(fractionDigits);
  const conditional = Array.from({ length: SECTIONS_ABOVE_BASE }, (_unused, index) => {
    const above = SECTIONS_ABOVE_BASE - index;
    return `[>=${threshold(above)}]${section(above)}${decimals}`;
  });
  return [...conditional, `${section(0)}${decimals}`].join(";");
}
