// R-UI-050's matrix for the draft-BOQ workspace, read from the one place it is declared.
//
// The roster lives with the screen it rules (`@/modules/takeoff/boq/states`), because the workspace
// derives its own state from it and a module may not read the app layer. This file is where the route
// tree names it — the matrix, the demonstration and `page.tsx` all read it from here — so there is one
// declaration and no second spelling to drift (B-17, B-19).
export { BOQ_STATES, boqStateOf, type BoqState } from "@/modules/takeoff/boq/states";
