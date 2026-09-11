// The schema tree's own barrel: every table the tree defines, in one place, so a table added here
// is in the drift lane's and the live suite's reach the moment it lands (B-19).
export * from "./tenants";
export * from "./projects";
export * from "./acts";
export * from "./identity";
export * from "./invitations";
export * from "./prefs";
export * from "./model";
export * from "./drawings";
export * from "./takeoff-ingest";
export * from "./takeoff-rasters";
export * from "./takeoff-sheets";
export * from "./takeoff-views";
export * from "./takeoff-grids";
export * from "./takeoff-schedules";
export * from "./takeoff-placements";
export * from "./takeoff-scale";
export * from "./catalogue";
export * from "./drawing-sets";
export * from "./register";
export * from "./takeoff-levels";
export * from "./quantity-lines";
export * from "./takeoff-scope";
export * from "./ai";
// The M3 areas, already named so a rail that lands a table has a file to re-export it from and the
// drift lane sees it the moment it does (AM-11, B-19).
export * from "./foundations";
export * from "./frame";
export * from "./slabs";
export * from "./masonry";
export * from "./rebar";
export * from "./docs";
export * from "./boq";
