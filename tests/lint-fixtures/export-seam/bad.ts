// R-SPINE-041's payload: `exceljs` named from product source that is NOT the export seam.
//
// One seam owns the spreadsheet library (`src/core/exports/**`); every other consumer imports
// `@/core/exports`. This file is what the committed scan is proved on
// (src/core/exports/__tests__/exceljs-import-scan.ts), not an ESLint rule: `scripts/eslint/**` is
// locked, so the ban is a scan, exactly as the conversion factors and the gate import were done.
//
// Four shapes the specifier creeps back in as, one per line, each carrying the recorded reason
// Q-08 asks a lint fixture's payload to carry. Nothing here is imported by anything: it exists to
// be scanned, and the scan must report every one of these lines.

import ExcelJS from "exceljs"; // RECORDED REASON R-SPINE-041

export { Workbook } from "exceljs"; // RECORDED REASON R-SPINE-041

export const lazily = await import("exceljs"); // RECORDED REASON R-SPINE-041

export const required = require("exceljs"); // RECORDED REASON R-SPINE-041

// A recorded reason standing alone, with no import beside it. The scan is a scan of IMPORTS, not of
// this comment: a scanner keyed on the marker string would report this line, and it owes nothing
// here. // RECORDED REASON R-SPINE-041
export const unmarkedPayload = "nothing is imported on the line above";

// And the converse: the specifier reached for on a line that carries no recorded reason at all. The
// marker records a banned CONSTRUCT for Q-08; it is not what makes an import of the spreadsheet
// library a finding, so the scan owes this line a finding exactly as it owes the four above.
import * as unmarkedExcel from "exceljs";

export const reachedTwice = unmarkedExcel;

export const reached = ExcelJS;
