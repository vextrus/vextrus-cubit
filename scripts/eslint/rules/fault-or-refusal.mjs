// ARCH-03: one fault seam records every non-refusal server-side failure before any user-facing
// mapping. A server-side failure handler that maps a failure with neither a refusal code nor a
// fault report is a lint error — a swallowed catch is how an outage becomes a shrug, and a server
// fault, an expired session and a wrong credential are three different answers (B-21).
import { layerOf } from "../lib/layers.mjs";
import { isCallTo, propertyName, staticString } from "../lib/specifiers.mjs";

/** The layers that answer a request, and so must answer a failure. */
const SERVER_SIDE = new Set(["server", "app", "modules", "worker"]);

/** The fault seam's one name (ARCH-02). */
const FAULT = "reportFault";

/** The refusal verb, as a call: `refuse(...)`, `ctx.refusal(...)` — a refusal made, not mentioned. */
const REFUSAL_NAME = /^refus(?:e|al|ed|es)$/i;

/** A refusal registry code, as the registry spells them — `SIGNED_OUT` and its kin. */
const REFUSAL_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/** Functions written inside the catch are not the catch's own answer; a throw in one is not a rethrow. */
const NESTED = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

// The syntax-tree node type is read off ESLint's own surface, as the specifier reader reads it.
/**
 * @typedef {import("eslint").SourceCode} SourceCode
 * @typedef {NonNullable<Parameters<SourceCode["getText"]>[0]>} EsNode
 */

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "a server-side failure is reported as a fault or answered as a refusal (ARCH-03)" },
    schema: [],
    messages: {
      unanswered:
        "this failure is mapped with neither a refusal code nor a fault report — call reportFault(...) in core, or answer with a registry refusal and its remedy (ARCH-03, B-21)",
    },
  },
  create(context) {
    const site = layerOf(context.filename);
    if (site === null || !SERVER_SIDE.has(site.layer)) return {};
    const sourceCode = context.sourceCode;
    return {
      CatchClause: (node) => {
        if (answers(node.body, sourceCode)) return;
        context.report({ node, messageId: "unanswered" });
      },
    };
  },
};

/**
 * Does this catch answer the failure — by reporting a fault, by making a refusal, or by rethrowing?
 * The question is asked of the syntax tree, never of the text: a comment saying "throw" and a log
 * line saying "not a refusal" are prose, and prose does not answer an outage (ARCH-03, B-21). A
 * refusal counts when it is made — a call to the refusal verb, or a registry code spelled out —
 * never when it is merely named, or a local bound as `const refusal` would be the whole answer.
 * @param {EsNode} root the catch clause's block
 * @param {import("eslint").SourceCode} sourceCode
 * @returns {boolean}
 */
function answers(root, sourceCode) {
  const keys = sourceCode.visitorKeys;
  /** @type {EsNode[]} */
  const stack = [root];
  while (stack.length > 0) {
    const node = /** @type {EsNode} */ (stack.pop());
    if (node !== root && NESTED.has(node.type)) continue;
    if (node.type === "ThrowStatement") return true;
    if (node.type === "CallExpression" && (isCallTo(node.callee, FAULT, sourceCode) || callsRefusal(node.callee, sourceCode))) return true;
    if (node.type === "Literal" || node.type === "TemplateLiteral") {
      const value = staticString(node, sourceCode);
      if (value !== null && REFUSAL_CODE.test(value)) return true;
    }
    for (const key of keys[node.type] ?? []) {
      const child = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (node))[key];
      for (const entry of Array.isArray(child) ? child : [child]) {
        if (entry !== null && typeof entry === "object" && typeof (/** @type {{type?: unknown}} */ (entry).type) === "string") {
          stack.push(/** @type {EsNode} */ (entry));
        }
      }
    }
  }
  return false;
}

/**
 * Is this callee the refusal verb — plainly, through a member, or through a computed member?
 * @param {Parameters<typeof isCallTo>[0]} callee
 * @param {import("eslint").SourceCode} sourceCode
 * @returns {boolean}
 */
function callsRefusal(callee, sourceCode) {
  if (callee.type === "Identifier") return REFUSAL_NAME.test(callee.name);
  if (callee.type !== "MemberExpression") return false;
  const name = propertyName(callee, sourceCode);
  return name !== null && REFUSAL_NAME.test(name);
}
