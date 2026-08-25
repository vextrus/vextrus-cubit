// LAW-FMT: src/core/format.ts is the tree's sole caller of Intl, including Intl.Collator;
// toLocaleString and localeCompare are errors everywhere else. The ban home is an exact allowlist,
// and the globalThis and computed-member spellings are the same offence as the straight one (Q-01).
import { propertyName, staticString } from "../lib/specifiers.mjs";

/** The one lawful home of locale-sensitive formatting (LAW-FMT). */
const ALLOWED = "src/core/format.ts";

/** Methods that format or compare through the platform's locale machinery. */
const LOCALE_METHODS = new Set(["toLocaleString", "toLocaleDateString", "toLocaleTimeString", "localeCompare"]);

/**
 * `en-BD` is not a CLDR locale: it falls back to Western grouping, so a number formatted with it is
 * silently wrong (LAW-FMT). The ban holds inside the allowlisted home too — that home is the only
 * place a locale tag can lawfully be written at all, so it is the only place this can be spelled.
 */
const BANNED_LOCALE = /^en-BD$/i;

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "Intl, toLocaleString and localeCompare live only in src/core/format.ts (LAW-FMT)" },
    schema: [],
    messages: {
      intl: "{{what}} — src/core/format.ts is the tree's sole caller of Intl; call the format helper instead (LAW-FMT)",
      locale: "'{{tag}}' is not a CLDR locale — it falls back to Western grouping, so it is banned everywhere, this file included (LAW-FMT)",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    const sourceCode = context.sourceCode;
    /** @param {import("eslint").Rule.Node} node @param {string} what */
    const report = (node, what) => context.report({ node, messageId: "intl", data: { what } });
    /** The banned locale tag is refused in every file, including the allowlisted home. */
    const locales = {
      /** @param {import("eslint").Rule.Node} node */
      Literal: (node) => {
        const tag = staticString(node, sourceCode);
        if (tag !== null && BANNED_LOCALE.test(tag)) context.report({ node, messageId: "locale", data: { tag } });
      },
      /** @param {import("eslint").Rule.Node} node */
      TemplateLiteral: (node) => {
        const tag = staticString(node, sourceCode);
        if (tag !== null && BANNED_LOCALE.test(tag)) context.report({ node, messageId: "locale", data: { tag } });
      },
    };
    if (filename.endsWith(ALLOWED)) return locales;
    return {
      ...locales,
      Identifier: (node) => {
        const parent = node.parent;
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
