// The seam's nearest neighbour: a file inside src/core, one directory above the seam itself. A
// relative specifier is resolved against this file before the interior test reads it, so reaching
// past the barrel with `./model/transport` is refused here exactly as `@/core/model/transport` is
// anywhere else — these are the files most able to reach around callModel (L-AI-01).
export { transport } from "./model/transport"; // RECORDED REASON L-AI-01
export * from "./model/registry"; // RECORDED REASON L-AI-01
