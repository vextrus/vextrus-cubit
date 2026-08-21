/**
 * Q-08 — no lint-disable directive and no TypeScript error-suppression comment
 * in a change without a recorded reason. The recorded reason belongs in the
 * increment's spec, not in a comment that silences the gate, so the comment
 * itself is the error.
 *
 * The directives are assembled from their parts rather than spelled, so that
 * this file is not a hit for the guardrail it enforces: a structural diff of a
 * change (Q-08's own check) reads text, and a rule that spells the string it
 * forbids reports its own implementation. The only sites in the tree that
 * spell them are the fixtures that prove this rule fires, and the reason for
 * those is recorded in docs/toolchain.md.
 *
 * The flat config sets `linterOptions.noInlineConfig`, so a blanket disable
 * directive cannot switch this rule off before it reports.
 */
const LINT_DIRECTIVE = ['eslint', 'disable'].join('-');
const TYPE_SUPPRESSIONS = ['ignore', 'expect-error', 'nocheck'].map((word) => `@ts-${word}`);

const SUPPRESSIONS = [
  new RegExp(`\\b${LINT_DIRECTIVE}(-next-line|-line)?\\b`),
  ...TYPE_SUPPRESSIONS.map((directive) => new RegExp(`${directive}\\b`)),
];

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'forbid lint-disable directives and type-error suppression comments (Q-08)',
    },
    schema: [],
    messages: {
      suppression:
        'Q-08: "{{directive}}" suppresses a guardrail. Fix the code, or record the reason in the increment spec.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          for (const pattern of SUPPRESSIONS) {
            const found = pattern.exec(comment.value);
            if (found !== null) {
              context.report({
                loc: comment.loc ?? { line: 1, column: 0 },
                messageId: 'suppression',
                data: { directive: found[0] },
              });
              break;
            }
          }
        }
      },
    };
  },
};

export default rule;
