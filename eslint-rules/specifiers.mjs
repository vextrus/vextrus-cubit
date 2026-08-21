/**
 * Every module a file pulls in, however it spells the pull: static import, re-export,
 * dynamic import, require. A seam rule that only reads static imports is a seam rule with
 * a hole in it, so the specifier is read from all four forms — and from a backtick with no
 * interpolation, which is a constant specifier written the other way.
 */

/** The constant string a specifier node states, or null when it is computed at runtime. */
export function constantSpecifier(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    const [only] = node.quasis;
    return only?.value.cooked ?? null;
  }
  return null;
}

/**
 * Visitors that call `check(specifier, node)` for every module specifier in the file.
 * A dynamic specifier reaches `check` as null, which each rule treats as unknowable.
 */
export function moduleSpecifierVisitors(check) {
  const fromSource = (node) => {
    if (!node.source) return;
    check(constantSpecifier(node.source), node.source);
  };
  return {
    ImportDeclaration: fromSource,
    ExportNamedDeclaration: fromSource,
    ExportAllDeclaration: fromSource,
    ImportExpression(node) {
      check(constantSpecifier(node.source), node.source);
    },
    CallExpression(node) {
      const callee = node.callee;
      const isRequire =
        (callee.type === 'Identifier' && callee.name === 'require') ||
        (callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'require' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'resolve');
      if (!isRequire) return;
      const [first] = node.arguments;
      if (!first) return;
      check(constantSpecifier(first), first);
    },
  };
}
