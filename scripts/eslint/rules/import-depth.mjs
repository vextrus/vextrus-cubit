// ARCH-01 is a statement about layers, so a specifier has to say which layer it reaches. A climb of
// three or more `../` segments that lands back inside `src/` says only how far up the disk it went:
// the layer is invisible at the call site and moves with the file. The `@/` alias names the layer
// from the root of the tree, and the boundary rules read it as the same target (ARCH-02), so the
// aliased spelling is the one the matrix can be read against.
//
// A climb of any depth to a target outside the layered tree — `db/`, `tests/` — is left alone: no
// alias reaches it, and there is no layer to name. Like every rule that judges the geography, this
// one is silent outside `src/`.
import { layerOf, targetOf } from "../lib/layers.mjs";
import { specifierVisitors } from "../lib/specifiers.mjs";

/**
 * How many `..` segments a specifier opens with — the depth of its climb. A single leading `./`
 * is read past, and the last segment counts whether or not a path follows it, so `"../../.."` is
 * the same three-segment climb as `"../../../x"`.
 * @param {string} specifier
 * @returns {number}
 */
function leadingClimb(specifier) {
  const segments = specifier.split("/");
  let at = segments[0] === "." ? 1 : 0;
  let depth = 0;
  while (segments[at] === "..") {
    depth += 1;
    at += 1;
  }
  return depth;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "a module specifier that climbs three or more directories back into the layered tree" },
    schema: [],
    messages: {
      depth: '"{{specifier}}" climbs {{depth}} directories back into src/{{target}} — spell it "@/{{target}}", which names the layer it reaches (ARCH-01)',
    },
  },
  create(context) {
    if (layerOf(context.filename) === null) return {};
    return specifierVisitors(context, ({ value, node }) => {
      const depth = leadingClimb(value);
      if (depth < 3) return;
      const to = targetOf(value, context.filename);
      if (to === null) return;
      context.report({ node, messageId: "depth", data: { specifier: value, depth: String(depth), target: to.path } });
    });
  },
};
