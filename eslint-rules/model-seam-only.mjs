/**
 * L-AI-01 — `callModel` in core is the only path to a model. Importing a model
 * SDK anywhere else routes around the seam that carries the refusal register,
 * the budget and the audit trail, so it is an error.
 */
import { isInsideSeam, staticSpecifier } from './seam.mjs';

const SEAM_DIR = 'src/core/';

const MODEL_SDKS = [
  '@anthropic-ai/sdk',
  '@anthropic-ai/claude-agent-sdk',
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/vertex-sdk',
  'openai',
  '@azure/openai',
  '@google/generative-ai',
  '@google/genai',
  '@mistralai/mistralai',
  'cohere-ai',
  'ollama',
  'ai',
  '@ai-sdk/anthropic',
  '@ai-sdk/openai',
  'langchain',
];

/** @param {string} specifier */
function isModelSdk(specifier) {
  return MODEL_SDKS.some(
    (sdk) => specifier === sdk || specifier.startsWith(`${sdk}/`),
  );
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: `forbid model-SDK imports outside ${SEAM_DIR} (L-AI-01)`,
    },
    schema: [],
    messages: {
      sdk: 'L-AI-01: "{{specifier}}" is a model SDK. Only src/core reaches a model; call callModel().',
    },
  },
  create(context) {
    if (isInsideSeam(context, SEAM_DIR)) {
      return {};
    }

    /**
     * @param {import('eslint').Rule.Node} node
     * @param {unknown} value
     */
    const check = (node, value) => {
      if (typeof value === 'string' && isModelSdk(value)) {
        context.report({ node, messageId: 'sdk', data: { specifier: value } });
      }
    };

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          check(node, node.source.value);
        }
      },
      ExportAllDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        check(node, staticSpecifier(node.source));
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          check(node, staticSpecifier(node.arguments[0]));
        }
      },
    };
  },
};

export default rule;
