/*
 * The Takeoff's Step 1 (ticket 22; m0-screens §4.7, §5, §6): the screen at `/p/:code/takeoff/1`,
 * layout A, "List ⇄ Sheet", on 19a's Step 1 API.
 *
 *   <Step1Page />      the route's component (routes/_app/p/$code/takeoff/1.tsx)
 *   step1SheetPath('KR-01', sheetId)   "/p/KR-01/takeoff/1?sheet=…": Step 1 opened on that printed sheet
 *   step1AddressFor('KR-01', sheet, sheets)   the same, written as the sheet's number where it is unique, else its id
 */
export { Step1Page } from './Step1Screen'
export { step1Model, type Step1Model } from './model'
export { sheetAddress, step1AddressFor, step1SheetPath } from './paths'
