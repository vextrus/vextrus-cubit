// The coverage module's barrel: the workspace stands in its own file so the one reader that mounts
// it — the route, and the suite that mounts the very same component — names it directly, while every
// other importer reaches the module by its folder (B-17: one home, reached one way).
export * from "./coverage-workspace";
