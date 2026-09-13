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

export const reached = ExcelJS;
