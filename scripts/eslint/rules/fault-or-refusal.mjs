// ARCH-03: one fault seam records every non-refusal server-side failure before any user-facing
// mapping. A server-side failure handler that maps a failure with neither a refusal code nor a
// fault report is a lint error — a swallowed catch is how an outage becomes a shrug, and a server
// fault, an expired session and a wrong credential are three different answers (B-21).
import { layerOf } from "../lib/layers.mjs";

/** The layers that answer a request, and so must answer a failure. */
const SERVER_SIDE = new Set(["server", "app", "modules", "worker"]);

/** The fault seam's one name (ARCH-02). */
const FAULT = /\breportFault\s*\(/;

/** A refusal: the registry code and its remedy, rendered by the one renderer. */
const REFUSAL = /\brefus(?:e|al|ed|es)\b|\bREFUSAL\b|\bSIGNED_OUT\b/i;

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
        const body = sourceCode.getText(node.body);
        if (FAULT.test(body) || REFUSAL.test(body)) return;
        if (/\bthrow\b/.test(body)) return;
        context.report({ node, messageId: "unanswered" });
      },
    };
  },
};
