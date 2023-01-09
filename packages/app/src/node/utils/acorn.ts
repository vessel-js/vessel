import * as acorn from 'acorn';
import MagicString from 'magic-string';

/** This only replaces top-level declarations. */
export function parseAndReplaceVars(
  code: string,
  vars: Set<string>,
  replace: (varName: string) => string,
) {
  const newCode = new MagicString(code),
    results = parseAndFindVarRanges(code, vars);

  for (const [name, start, end] of results) {
    newCode.overwrite(start, end, `const ${name} = ${replace(name)};\n`);
  }

  return newCode;
}

/** This only looks at top-level declarations. */
export function parseAndFindVarRanges(code: string, vars: Set<string>) {
  const ast = acorn.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  }) as any;

  const results: [name: string, start: number, end: number][] = [];

  for (let node of ast.body) {
    if (results.length === vars.size) {
      break;
    } else if (node.type === 'ExportNamedDeclaration') {
      node = node.declaration;
    }

    if (node.type === 'FunctionDeclaration' && vars.has(node.id.name)) {
      results.push([node.id.name, node.start, node.end]);
    } else if (node.type === 'VariableDeclaration' && vars.has(node.declarations[0].id.name)) {
      results.push([node.declarations[0].id.name, node.start, node.end]);
    }
  }

  return results;
}
