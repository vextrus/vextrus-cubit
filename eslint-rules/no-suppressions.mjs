/**
 * Q-08 — no lint-disable directive and no TypeScript error-suppression comment
 * in a change without a recorded reason. The recorded reason belongs in the
 * increment's spec, not in a comment that silences the gate, so the comment
 * itself is the error. The directives this rule forbids appear below as
 * regular expressions and nowhere in prose, so that the rule does not report
 * its own documentation.
 *
 * The flat config sets `linterOptions.noInlineConfig`, so a blanket disable
 * directive cannot switch this rule off before it reports.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const SUPPRESSIONS = [
  /\beslint-disable(-next-line|-line)?\b/,
  /@ts-ignore\b/,
  /@ts-expect-error\b/,
  /@ts-nocheck\b/,
];

export default {
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
