// AM-09 §4, B-19: a journey reads the product through RETRYING waits, or it does not read it.
//
// `locator.count()`, `.all()`, `.textContent()` and `.innerText()` take ONE reading at one instant.
// A screen that is still arriving hands that reading a number that was true for a frame and is true
// in no frame a person ever sees — and the assertion built on it passes or fails by the millisecond
// the runner happened to arrive. That is the whole anatomy of a flake, and B-19 says a flake is a
// defect with a cause, never a retry. The lawful spellings all re-read until the page agrees:
// `expect(locator).toHaveCount(n)`, `toHaveText`, `locator.waitFor()`, and `expect.poll(() => …)`
// for everything those three cannot say.
//
// The one-shot readers are therefore admitted in exactly one place: inside the callback
// `expect.poll` re-runs. There the single reading is the poll's subject, not the assertion's, and
// the retry is the poll's.
//
// `page.waitForTimeout` has no such door. A sleep asserts nothing about the page: it is either too
// short (a flake) or too long (the tax every green run pays). `tests/e2e/support/settled.ts` is what
// replaces it — it states what "settled" means and polls for it.

/** The one-shot readers. A locator method that answers once and never looks again. */
const ONE_SHOT = new Set(["all", "count", "textContent", "innerText"]);

/** The sleep. No door, no callback, no exception. */
const SLEEP = "waitForTimeout";

/**
 * Is this node lexically inside the callback `expect.poll` re-runs? Only the FIRST argument counts:
 * `expect.poll(fn, { timeout })` retries `fn`, and nothing else it is handed.
 * @param {import("eslint").Rule.Node[]} ancestors outermost first, as ESLint hands them over
 * @param {import("eslint").Rule.Node} node
 * @returns {boolean}
 */
function insidePoll(ancestors, node) {
  const chain = [...ancestors, node];
  for (let at = 0; at < chain.length - 1; at += 1) {
    const parent = chain[at];
    if (parent === undefined || parent.type !== "CallExpression") continue;
    const callee = parent.callee;
    if (callee.type !== "MemberExpression" || callee.computed) continue;
    if (callee.property.type !== "Identifier" || callee.property.name !== "poll") continue;
    if (callee.object.type !== "Identifier" || callee.object.name !== "expect") continue;
    if (parent.arguments[0] === chain[at + 1]) return true;
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: { description: "a one-shot read or a sleep where a journey owes a retrying wait (AM-09 §4, B-19)" },
    schema: [],
    messages: {
      oneShot:
        "`.{{name}}()` reads the page once, at one instant — the assertion built on it passes by timing, not by the screen (B-19). Use a retrying wait: expect(locator).toHaveCount/toHaveText, locator.waitFor(), or put this read inside an expect.poll(() => …) callback.",
      sleep:
        "`waitForTimeout` asserts nothing about the page: too short is a flake, too long is a tax on every green run (AM-09 §4). Await `settled(page)` (tests/e2e/support/settled.ts) or a retrying wait for the thing the sleep was standing in for.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier") return;
        const name = callee.property.name;
        if (name === SLEEP) {
          context.report({ node: callee.property, messageId: "sleep" });
          return;
        }
        if (!ONE_SHOT.has(name)) return;
        if (node.arguments.length > 0) return;
        const ancestors = /** @type {import("eslint").Rule.Node[]} */ (
          /** @type {unknown} */ (context.sourceCode.getAncestors(node))
        );
        if (insidePoll(ancestors, node)) return;
        context.report({ node: callee.property, messageId: "oneShot", data: { name } });
      },
    };
  },
};
