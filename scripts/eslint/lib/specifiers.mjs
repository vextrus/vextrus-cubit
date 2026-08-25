// Every shape a module specifier can take, read once (ARCH-02). A rule that only knows the
// straight `import x from "y"` spelling is half a rule (Q-01), so this collector also reads
// re-exports, dynamic imports, template-literal specifiers, `require` — including the computed and
// `globalThis` spellings — and identifiers bound once to a literal.

/**
 * @typedef {{value: string, node: object, typeOnly: boolean}} Specifier
 */

/**
 * The static string a node evaluates to, or null when it is not knowable at lint time.
 * @param {any} node
 * @param {any} sourceCode
 * @returns {string | null}
 */
export function staticString(node, sourceCode) {
  if (node === null || node === undefined) return null;
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : null;
  if (node.type === "TemplateLiteral") return node.expressions.length === 0 ? (node.quasis[0]?.value?.cooked ?? null) : null;
  if (node.type === "Identifier") {
    const variable = findVariable(sourceCode, node);
    if (variable === null || variable.defs.length !== 1) return null;
    const def = variable.defs[0];
    if (def.type !== "Variable" || def.node.init === null || def.node.init === undefined) return null;
    if (def.parent !== undefined && def.parent.kind !== "const") return null;
    return staticString(def.node.init, sourceCode);
  }
  return null;
}

/**
 * @param {any} sourceCode
 * @param {any} node
 * @returns {any}
 */
function findVariable(sourceCode, node) {
  let scope = sourceCode.getScope(node);
  while (scope !== null) {
    const found = scope.variables.find((/** @type {any} */ variable) => variable.name === node.name);
    if (found !== undefined) return found;
    scope = scope.upper;
  }
  return null;
}

/**
 * The property name a member expression reads, computed or not.
 * @param {any} node a MemberExpression
 * @param {any} sourceCode
 * @returns {string | null}
 */
export function propertyName(node, sourceCode) {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return staticString(node.property, sourceCode);
}

/**
 * Is this callee a call to `name` — plainly, through a computed member, or through globalThis?
 * @param {any} callee
 * @param {string} name
 * @param {any} sourceCode
 * @returns {boolean}
 */
export function isCallTo(callee, name, sourceCode) {
  if (callee.type === "Identifier") return callee.name === name;
  if (callee.type === "MemberExpression") return propertyName(callee, sourceCode) === name;
  return false;
}

/**
 * Visitors that hand every module specifier in a file to `report`.
 * @param {any} context
 * @param {(specifier: Specifier) => void} report
 * @returns {Record<string, (node: any) => void>}
 */
export function specifierVisitors(context, report) {
  const sourceCode = context.sourceCode;
  /** @param {any} node @param {any} source @param {boolean} typeOnly */
  const offer = (node, source, typeOnly) => {
    const value = staticString(source, sourceCode);
    if (value !== null) report({ value, node, typeOnly });
  };
  return {
    ImportDeclaration: (node) => offer(node, node.source, node.importKind === "type" || allSpecifiersAreTypes(node)),
    ExportNamedDeclaration: (node) => {
      if (node.source !== null && node.source !== undefined) offer(node, node.source, node.exportKind === "type");
    },
    ExportAllDeclaration: (node) => offer(node, node.source, node.exportKind === "type"),
    ImportExpression: (node) => offer(node, node.source, false),
    CallExpression: (node) => {
      if (isCallTo(node.callee, "require", sourceCode) || isCallTo(node.callee, "import", sourceCode)) offer(node, node.arguments[0], false);
    },
  };
}

/**
 * @param {any} node an ImportDeclaration
 * @returns {boolean}
 */
function allSpecifiersAreTypes(node) {
  const named = node.specifiers.filter((/** @type {any} */ specifier) => specifier.type === "ImportSpecifier");
  return named.length > 0 && named.length === node.specifiers.length && named.every((/** @type {any} */ specifier) => specifier.importKind === "type");
}
