// Q-08: no TypeScript error suppression, no lint-disable directive, no unrun test. Suppressions
// are read from the file's comments and from the call itself, so a computed `it["only"]` is the
// same offence as the straight spelling (Q-01). The one exception Q-08 allows — a payload line
// inside a declared lint fixture — is recorded by the structural gate, not granted here: the
// corpus is what the rules are proven against, so the rule must fire on it.
import { propertyName } from "../lib/specifiers.mjs";

/** Comment shapes that turn a guardrail off. */
const SUPPRESSIONS = [
  { pattern: /eslint-disable(?:-next-line|-line)?\b/, what: "an eslint-disable directive" },
  { pattern: /@ts-ignore\b/, what: "a @ts-ignore" },
  { pattern: /@ts-expect-error\b/, what: "a @ts-expect-error" },
  { pattern: /@ts-nocheck\b/, what: "a @ts-nocheck" },
];

/** The test-runner entry points whose .skip / .only leave an assertion unrun. */
const RUNNERS = new Set(["describe", "it", "test", "suite", "bench", "context"]);

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "no suppression and no unrun assertion without a recorded reason (Q-08)" },
    schema: [],
    messages: {
      suppression: "{{what}} — a guardrail is never turned off in a change; fix the code or record the reason where the gate can see it (Q-08)",
      unrun: "{{what}} leaves an assertion unrun — an intentionally-not-run assertion surfaces as a recorded skip with an unforgeable trigger, never as .skip or .only (Q-08, C-06)",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program: () => {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.loc == null) continue;
          for (const suppression of SUPPRESSIONS) {
            if (suppression.pattern.test(comment.value)) {
              context.report({ loc: comment.loc, messageId: "suppression", data: { what: suppression.what } });
            }
          }
        }
      },
      MemberExpression: (node) => {
        const property = propertyName(node, sourceCode);
        if (property !== "skip" && property !== "only") return;
        // `globalThis.test.skip` names the runner in the inner member's *property*, not in its
        // object — the same resolution isCallTo already makes, so the indirected spelling is the
        // same offence as the straight one (Q-01).
        const object = node.object;
        const runner = object.type === "Identifier" ? object.name : object.type === "MemberExpression" ? propertyName(object, sourceCode) : null;
        if (runner === null || !RUNNERS.has(runner)) return;
        context.report({ node, messageId: "unrun", data: { what: `${runner}.${property}` } });
      },
    };
  },
};
