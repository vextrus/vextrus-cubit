// R-SPINE-060: one typed string table, assembled from the per-module tables in this directory. A
// screen imports `strings` and never a module table directly, so a key moving between modules is
// not a rename at the call site; `StringKey` is the union the compiler refuses a missing key with.
import { auth } from "./auth";
import { consequenceDialog } from "./consequence-dialog";
import { design } from "./design";
import { dropzone } from "./dropzone";
import { home } from "./home";
import { offeredGroup } from "./offered-group";
import { participants } from "./participants";
import { screenStates } from "./screen-states";
import { shell } from "./shell";
import { spine } from "./spine";
import { viewer } from "./viewer";
import { viewerInspector } from "./viewer-inspector";

export const strings = {
  ...auth,
  ...consequenceDialog,
  ...design,
  ...dropzone,
  ...home,
  ...offeredGroup,
  ...participants,
  ...screenStates,
  ...shell,
  ...spine,
  ...viewer,
  ...viewerInspector,
} as const;

export type StringKey = keyof typeof strings;

/**
 * A registered string with its named slots filled — `{date}` and its kin (R-SPINE-060). Substitution
 * has one home here rather than a `replace` at each call site, so a slot the caller has no value for
 * is left standing as itself instead of becoming the word "undefined" on a screen.
 */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}
