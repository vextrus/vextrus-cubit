/**
 * cubit/no-suppressions — Q-08: no lint suppression and no compiler-silencing directive
 * "in a change without a recorded reason".
 *
 * The directives are assembled from parts here rather than written out. The structural
 * diff check is textual: a file that spells a directive becomes a hit for adding one, and
 * a guardrail that cannot be read without tripping its own gate is not maintainable.
 */

/** The lint suppression, in all its spellings — line, block, next-line, ranged. */
const LINT_SUPPRESSION = ['eslint', 'disable'].join('-');

/** The compiler-silencing directives, by name, under one prefix. */
const COMPILER_PREFIX = ['@ts', ''].join('-');
const COMPILER_DIRECTIVES = ['ignore', ['expect', 'error'].join('-'), 'nocheck'].map(
  (name) => `${COMPILER_PREFIX}${name}`,
);

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Q-08: a rule turned off or a type error silenced needs a recorded reason; without one it is a defect made invisible.',
    },
    schema: [],
    messages: {
      lint: 'Q-08: this comment turns a rule off. The guardrail is the point — fix the code, or record the reason where the gate can read it.',
      compiler:
        'Q-08: this comment silences the compiler. A type that cannot be stated is a design to change, not a line to mute.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          const text = comment.value;
          if (text.includes(LINT_SUPPRESSION)) {
            context.report({ node: comment, messageId: 'lint' });
            continue;
          }
          if (COMPILER_DIRECTIVES.some((directive) => text.includes(directive))) {
            context.report({ node: comment, messageId: 'compiler' });
          }
        }
      },
    };
  },
};
