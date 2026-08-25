// LAW-FMT: src/core/format.ts is the tree's sole caller of Intl, including Intl.Collator;
// toLocaleString and localeCompare are errors everywhere else. The ban home is an exact allowlist,
// and the globalThis and computed-member spellings are the same offence as the straight one (Q-01).
import { propertyName } from "../lib/specifiers.mjs";

/** The one lawful home of locale-sensitive formatting (LAW-FMT). */
const ALLOWED = "src/core/format.ts";

/** Methods that format or compare through the platform's locale machinery. */
const LOCALE_METHODS = new Set(["toLocaleString", "toLocaleDateString", "toLocaleTimeString", "localeCompare"]);

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Intl, toLocaleString and localeCompare live only in src/core/format.ts (LAW-FMT)" },
    schema: [],
    messages: {
      intl: "{{what}} — src/core/format.ts is the tree's sole caller of Intl; call the format helper instead (LAW-FMT)",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    if (filename.endsWith(ALLOWED)) return {};
    const sourceCode = context.sourceCode;
    /** @param {any} node @param {string} what */
    const report = (node, what) => context.report({ node, messageId: "intl", data: { what } });
    return {
      Identifier: (node) => {
        const parent = /** @type {any} */ (node).parent;
        if (node.name !== "Intl") return;
        if (parent !== undefined && parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
        if (parent !== undefined && parent.type === "Property" && parent.key === node && !parent.computed) return;
        report(node, "Intl");
      },
      MemberExpression: (node) => {
        const property = propertyName(node, sourceCode);
        if (property === null) return;
        if (property === "Intl") report(node, "globalThis.Intl");
        else if (LOCALE_METHODS.has(property)) report(node, property);
      },
    };
  },
};
