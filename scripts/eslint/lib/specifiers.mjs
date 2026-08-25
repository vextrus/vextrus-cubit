// Every shape a module specifier can take, read once (ARCH-02). A rule that only knows the
// straight `import x from "y"` spelling is half a rule (Q-01), so this collector also reads
// re-exports, dynamic imports, template-literal specifiers, `require` — including the computed and
// `globalThis` spellings — and identifiers bound once to a literal.

// The shared syntax-tree types are read off ESLint's own surface rather than from a second
// declaration package, so the toolchain depends on nothing the increment does not name.
/**
 * @typedef {import("eslint").Rule.Node} RuleNode
 * @typedef {import("eslint").SourceCode} SourceCode
 * @typedef {NonNullable<Parameters<SourceCode["getText"]>[0]>} EsNode
 * @typedef {Extract<EsNode, {type: "Identifier"}>} IdentifierNode
 * @typedef {Extract<EsNode, {type: "MemberExpression"}>} MemberExpressionNode
 * @typedef {Extract<EsNode, {type: "ImportDeclaration"}>} ImportDeclarationNode
 */

/**
 * @typedef {{value: string, node: RuleNode, typeOnly: boolean}} Specifier
 */

/**
 * `import type` and `export type` are TypeScript's extension to ESTree: the shared node types do
 * not carry the field, so it is read as the optional property it is.
 * @param {object} node
 * @returns {string | undefined}
 */
function kindOf(node) {
  const carrier = /** @type {{importKind?: string, exportKind?: string}} */ (node);
  return carrier.importKind ?? carrier.exportKind;
}

/**
 * The static string a node evaluates to, or null when it is not knowable at lint time.
 * @param {EsNode | null | undefined} node
 * @param {SourceCode} sourceCode
 * @returns {string | null}
 */
export function staticString(node, sourceCode) {
  if (node === null || node === undefined) return null;
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : null;
  if (node.type === "TemplateLiteral") return node.expressions.length === 0 ? (node.quasis[0]?.value.cooked ?? null) : null;
  if (node.type === "Identifier") {
    const variable = findVariable(sourceCode, node);
    if (variable === null || variable.defs.length !== 1) return null;
    const def = variable.defs[0];
    if (def === undefined || def.type !== "Variable" || def.parent.kind !== "const") return null;
    return staticString(def.node.init, sourceCode);
  }
  return null;
}

/**
 * @param {SourceCode} sourceCode
 * @param {IdentifierNode} node
 * @returns {import("eslint").Scope.Variable | null}
 */
function findVariable(sourceCode, node) {
  /** @type {import("eslint").Scope.Scope | null} */
  let scope = sourceCode.getScope(node);
  while (scope !== null) {
    const found = scope.variables.find((variable) => variable.name === node.name);
    if (found !== undefined) return found;
    scope = scope.upper;
  }
  return null;
}

/**
 * The property name a member expression reads, computed or not.
 * @param {MemberExpressionNode} node
 * @param {SourceCode} sourceCode
 * @returns {string | null}
 */
export function propertyName(node, sourceCode) {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return staticString(node.property, sourceCode);
}

/**
 * Is this callee a call to `name` — plainly, through a computed member, or through globalThis?
 * @param {MemberExpressionNode["object"]} callee
 * @param {string} name
 * @param {SourceCode} sourceCode
 * @returns {boolean}
 */
export function isCallTo(callee, name, sourceCode) {
  if (callee.type === "Identifier") return callee.name === name;
  if (callee.type === "MemberExpression") return propertyName(callee, sourceCode) === name;
  return false;
}

/**
 * Visitors that hand every module specifier in a file to `report`.
 * @param {import("eslint").Rule.RuleContext} context
 * @param {(specifier: Specifier) => void} report
 * @returns {import("eslint").Rule.RuleListener}
 */
export function specifierVisitors(context, report) {
  const sourceCode = context.sourceCode;
  /**
   * @param {RuleNode} node
   * @param {EsNode | null | undefined} source
   * @param {boolean} typeOnly
   */
  const offer = (node, source, typeOnly) => {
    const value = staticString(source, sourceCode);
    if (value !== null) report({ value, node, typeOnly });
  };
  return {
    ImportDeclaration: (node) => offer(node, node.source, kindOf(node) === "type" || allSpecifiersAreTypes(node)),
    ExportNamedDeclaration: (node) => {
      if (node.source !== null && node.source !== undefined) offer(node, node.source, kindOf(node) === "type");
    },
    ExportAllDeclaration: (node) => offer(node, node.source, kindOf(node) === "type"),
    ImportExpression: (node) => offer(node, node.source, false),
    CallExpression: (node) => {
      if (isCallTo(node.callee, "require", sourceCode) || isCallTo(node.callee, "import", sourceCode)) offer(node, node.arguments[0], false);
    },
  };
}

/**
 * @param {ImportDeclarationNode} node
 * @returns {boolean}
 */
function allSpecifiersAreTypes(node) {
  const named = node.specifiers.filter((specifier) => specifier.type === "ImportSpecifier");
  return named.length > 0 && named.length === node.specifiers.length && named.every((specifier) => kindOf(specifier) === "type");
}
