/**
 * cubit/model-seam-only — L-AI-01: "`callModel` in core is the only path to a model;
 * importing the SDK elsewhere is a lint error with a fixture test."
 *
 * One path means one importer: src/core/ pins the model id, attributes tokens to a tenant
 * and writes the model-call ledger. An SDK import anywhere else is a second path.
 */
import { isUnder } from './paths.mjs';
import { moduleSpecifierVisitors } from './specifiers.mjs';

const CORE = 'src/core';

/** Model SDKs and transports. A prefix match covers each vendor's sub-packages. */
const MODEL_PACKAGES = [
  '@anthropic-ai/sdk',
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/vertex-sdk',
  '@anthropic-ai/claude-agent-sdk',
  'openai',
  '@azure/openai',
  '@google/generative-ai',
  '@google/genai',
  '@mistralai/mistralai',
  'cohere-ai',
  'ollama',
  '@aws-sdk/client-bedrock-runtime',
  'ai',
  '@ai-sdk',
  'langchain',
  '@langchain',
  'llamaindex',
];

function isModelPackage(specifier) {
  return MODEL_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`));
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'L-AI-01: callModel in src/core is the only path to a model.',
    },
    schema: [],
    messages: {
      sdk: 'L-AI-01: {{specifier}} is a model SDK — reach the model through callModel in {{core}}, which pins the id, attributes the tokens and writes the ledger.',
    },
  },
  create(context) {
    if (isUnder(context, CORE)) return {};
    return moduleSpecifierVisitors((specifier, node) => {
      if (specifier === null || !isModelPackage(specifier)) return;
      context.report({ node, messageId: 'sdk', data: { specifier, core: CORE } });
    });
  },
};
