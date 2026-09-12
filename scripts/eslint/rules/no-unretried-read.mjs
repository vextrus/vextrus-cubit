// AM-09 §4, B-19: a journey reads the product through RETRYING waits, or it does not read it.
//
// `locator.count()`, `.textContent()`, `.getAttribute()`, `.isVisible()`, `.evaluate()` and the rest
// of the set below take ONE reading at one instant.
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

/**
 * THE ONE-SHOT READERS, AND THE ARITY THAT DOES NOT SAVE THEM (P4b §4).
 *
 * The set was four names, and any argument at all opened the door: `locator.textContent({ timeout:
 * 1000 })` is still ONE reading — the timeout buys the element's existence, never its settledness —
 * and it was lawful. So was every reader the set had never heard of: `allTextContents`,
 * `isVisible`, `inputValue`, `getAttribute` (five call sites in the lane BRANCH on one) and
 * `evaluate`, which reads the whole DOM once.
 *
 * Arity is judged per name, because Playwright's own signatures differ and a foreign API that merely
 * shares a name must be left alone:
 *
 *   ZERO_ARG   `count()`, `all()`, `allTextContents()`, `allInnerTexts()` take nothing. `list.count(
 *              (entry) => entry.ok)` is therefore somebody else's count, and is not this rule's business.
 *   OPTIONED   `textContent(options?)`, `innerText`, `isVisible`, `isChecked`, `isEnabled`,
 *              `inputValue` take an options bag and read once with or without it.
 *   NAMED      `getAttribute(name, options?)` — one or two arguments, and one reading either way.
 *   ANY        `evaluate`/`evaluateAll` read the page once whatever they are handed.
 */
const ZERO_ARG = new Set(["all", "count", "allTextContents", "allInnerTexts"]);
const OPTIONED = new Set(["textContent", "innerText", "isVisible", "isChecked", "isEnabled", "inputValue"]);
const NAMED = new Set(["getAttribute"]);
const ANY_ARITY = new Set(["evaluate", "evaluateAll"]);

/**
 * Is this call a one-shot read of the page, at the arity its own name is read at?
 * @param {string} name
 * @param {number} args
 * @returns {boolean}
 */
function isOneShot(name, args) {
  if (ZERO_ARG.has(name)) return args === 0;
  if (OPTIONED.has(name)) return args <= 1;
  if (NAMED.has(name)) return args >= 1 && args <= 2;
  return ANY_ARITY.has(name);
}

/**
 * AN `evaluate` WHOSE ANSWER NOBODY KEEPS IS NOT A READ (AM-09 §4).
 *
 * `page.evaluate` is the lane's one door into the page for things Playwright has no verb for, and it
 * is used on both sides of that door: `await page.evaluate(() => window.scrollTo(0, 0))` is an ACT —
 * it asserts nothing, it changes the world, and re-running it would be wrong, not safer. What this
 * rule is about is the other use: an answer taken once and then branched on or asserted against. So
 * the evaluating reads are told apart by what happens to the value — a call standing alone as a
 * statement is an act, a call whose result is assigned, returned, awaited-into or compared is a read.
 * @param {import("eslint").Rule.Node & {parent?: import("eslint").Rule.Node}} node
 * @returns {boolean}
 */
function answerIsKept(node) {
  const parent = node.parent;
  if (parent === undefined) return false;
  if (parent.type === "ExpressionStatement") return false;
  if (parent.type === "AwaitExpression") {
    const beyond = /** @type {import("eslint").Rule.Node & {parent?: import("eslint").Rule.Node}} */ (parent).parent;
    return beyond !== undefined && beyond.type !== "ExpressionStatement";
  }
  return true;
}

/**
 * THE WRAPPERS THAT MAY READ ONCE, RECOGNISED BY NAME.
 *
 * `expect.poll`'s callback is one lawful home for a single reading; the other is the body of a
 * helper whose whole job is to re-read — `steadyCount` counts inside its own poll, `settled` takes
 * one `evaluate` per poll, `nextFrame` waits for a frame by asking the page for one. Those helpers
 * live in tests/e2e/support/ and are the spelling every journey is told to use, so the rule knows
 * them by the name they are declared under. A reader that is not one of these names is a reader that
 * answers once, wherever it is written.
 */
const RETRYING_WRAPPERS = new Set([
  "readWhen",
  "heldAttribute",
  "afterSettled",
  "appears",
  "rendered",
  "steadyCount",
  "steadyText",
  "steadyAttribute",
  "everyRow",
  "everyAttribute",
  "settled",
  "readSettle",
  "nextFrame",
]);

/**
 * The name this function node is declared under, if it has one: `function steadyCount()`, `const
 * steadyCount = () => …`, and `{ steadyCount() {} }` are all one name to a reader.
 * @param {import("eslint").Rule.Node} node
 * @returns {string|null}
 */
function declaredName(node) {
  if (node.type === "FunctionDeclaration") return node.id?.name ?? null;
  if (node.type !== "FunctionExpression" && node.type !== "ArrowFunctionExpression") return null;
  if (node.type === "FunctionExpression" && node.id !== null && node.id !== undefined) return node.id.name;
  const parent = /** @type {import("eslint").Rule.Node & {parent?: import("eslint").Rule.Node}} */ (node).parent;
  if (parent === undefined) return null;
  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
  if ((parent.type === "Property" || parent.type === "MethodDefinition") && !parent.computed && parent.key.type === "Identifier") return parent.key.name;
  return null;
}

/**
 * Is this node inside a callback HANDED to one of those helpers? `afterSettled(page, () => page.
 * evaluate(…))` reads once, on purpose, after the screen has published that it stopped arriving —
 * the wrapper is what makes the reading lawful, and it is named at the site. Same shape as
 * `expect.poll`'s first argument: the callback is the wrapper's, not the assertion's.
 * @param {import("eslint").Rule.Node[]} ancestors outermost first, as ESLint hands them over
 * @param {import("eslint").Rule.Node} node
 * @returns {boolean}
 */
function insideWrapperCallback(ancestors, node) {
  const chain = [...ancestors, node];
  for (let at = 0; at < chain.length - 1; at += 1) {
    const parent = chain[at];
    if (parent === undefined || parent.type !== "CallExpression") continue;
    const callee = parent.callee;
    const name = callee.type === "Identifier" ? callee.name : callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" ? callee.property.name : null;
    if (name === null || !RETRYING_WRAPPERS.has(name)) continue;
    if (parent.arguments.includes(/** @type {never} */ (chain[at + 1]))) return true;
  }
  return false;
}

/**
 * Is this node lexically inside a helper that re-reads for its caller?
 * @param {import("eslint").Rule.Node[]} ancestors outermost first, as ESLint hands them over
 * @returns {boolean}
 */
function insideRetryingWrapper(ancestors) {
  return ancestors.some((ancestor) => {
    const name = declaredName(ancestor);
    return name !== null && RETRYING_WRAPPERS.has(name);
  });
}

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
        "`.{{name}}()` reads the page once, at one instant — the assertion built on it passes by timing, not by the screen (B-19). Use a retrying wait: expect(locator).toHaveCount/toHaveText/toHaveAttribute, locator.waitFor(), one of tests/e2e/support/retrying-read.ts's answering reads (steadyCount, steadyText, steadyAttribute, everyRow), or put this read inside an expect.poll(() => …) callback.",
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
        if (!isOneShot(name, node.arguments.length)) return;
        if (ANY_ARITY.has(name) && !answerIsKept(/** @type {import("eslint").Rule.Node & {parent?: import("eslint").Rule.Node}} */ (node))) return;
        const ancestors = /** @type {import("eslint").Rule.Node[]} */ (
          /** @type {unknown} */ (context.sourceCode.getAncestors(node))
        );
        if (insidePoll(ancestors, node)) return;
        if (insideRetryingWrapper(ancestors)) return;
        if (insideWrapperCallback(ancestors, node)) return;
        context.report({ node: callee.property, messageId: "oneShot", data: { name } });
      },
    };
  },
};
