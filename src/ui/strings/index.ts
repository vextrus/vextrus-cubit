// R-SPINE-060: one typed string table, assembled from the per-module tables in this directory. A
// screen imports `strings` and never a module table directly, so a key moving between modules is
// not a rename at the call site; `StringKey` is the union the compiler refuses a missing key with.
import { auth } from "./auth";
import { spine } from "./spine";

export const strings = {
  ...auth,
  ...spine,
} as const;

export type StringKey = keyof typeof strings;
