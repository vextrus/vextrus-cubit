// L-AI-01: `callModel` in core is the only path to a model. Every module specifier that reaches a
// model provider — a known SDK, or the seam's own interior past its barrel — is refused outside the
// seam directory src/core/model/, which is this rule's own allowlist so widening the binding in the
// flat config cannot widen what is allowed.
import { targetOf } from "../lib/layers.mjs";
import { specifierVisitors } from "../lib/specifiers.mjs";

/** The one lawful home of the model seam (L-AI-01): a directory, spelled with its trailing slash. */
const ALLOWED = "src/core/model/";

/**
 * The closed roster of model-provider SDKs. An entry ending in `/` is a scope prefix; a bare entry
 * matches exactly or as the root of a subpath, so `openai-mock` is never a model SDK.
 */
const SDKS = Object.freeze([
  "@anthropic-ai/",
  "@openai/",
  "openai",
  "ai",
  "@ai-sdk/",
  "@google/genai",
  "@google/generative-ai",
  "@google-cloud/vertexai",
  "@aws-sdk/client-bedrock",
  "@aws-sdk/client-bedrock-runtime",
  "@azure/openai",
  "@azure-rest/ai-inference",
  "@openrouter/",
  "cohere-ai",
  "@mistralai/",
  "groq-sdk",
  "together-ai",
  "@huggingface/inference",
  "ollama",
  "langchain",
  "@langchain/",
  "replicate",
]);

/** The seam's interior, read from a resolved layer path: `core/model/` plus one more character. */
const INTERIOR = /^core\/model\/./;

/**
 * @param {string} value
 * @returns {boolean}
 */
function isModelSdk(value) {
  const specifier = value.startsWith("node:") ? value.slice(5) : value;
  return SDKS.some((entry) => (entry.endsWith("/") ? specifier.startsWith(entry) : specifier === entry || specifier.startsWith(`${entry}/`)));
}

/**
 * Does this specifier reach past the barrel into the seam's interior? The question "which file in
 * the layered tree does this specifier name" has one home — `targetOf` (ARCH-02) — so a relative
 * specifier is resolved against the importing file there, and a package specifier resolves to
 * nothing: `@acme/kit/core/model/schema` names another tree's directory, not this seam.
 * @param {string} value
 * @param {string} filename
 * @returns {boolean}
 */
function reachesInterior(value, filename) {
  const site = targetOf(value, filename);
  return site !== null && INTERIOR.test(site.path);
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "model SDKs and the model seam's interior are reachable only through callModel (L-AI-01)" },
    schema: [],
    messages: {
      sdk: "'{{specifier}}' is a model SDK — only src/core/model may hold one; reach a model through callModel(), which pins the id, attributes the tokens and records the call (L-AI-01)",
      transport: "'{{specifier}}' reaches inside the model seam — src/core/model exports the one lawful path, and callModel() is it (L-AI-01)",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    if (filename.includes(`/${ALLOWED}`) || filename.startsWith(ALLOWED)) return {};
    return specifierVisitors(context, ({ value, node }) => {
      if (isModelSdk(value)) context.report({ node, messageId: "sdk", data: { specifier: value } });
      else if (reachesInterior(value, filename)) context.report({ node, messageId: "transport", data: { specifier: value } });
    });
  },
};
