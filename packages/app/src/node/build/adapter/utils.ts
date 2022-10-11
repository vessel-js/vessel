import * as acorn from 'acorn';
import { Plugin as EsBuildPlugin } from 'esbuild';
import fs from 'node:fs';

export function noopStaticLoader(): EsBuildPlugin {
  return {
    name: 'noop-static-loader',
    setup(build) {
      build.onLoad({ filter: /\.vessel\/server\/nodes/ }, (args) => {
        let contents = fs.readFileSync(args.path, 'utf-8');

        const ast = acorn.parse(contents, {
          ecmaVersion: 'latest',
          sourceType: 'module',
        }) as any;

        for (const node of ast.body) {
          if (
            node.type === 'FunctionDeclaration' &&
            node.id.name === 'staticLoader'
          ) {
            contents = replaceStaticLoader(contents, node.start, node.end);
          } else if (
            node.type === 'VariableDeclaration' &&
            node.declarations[0].id.name === 'staticLoader'
          ) {
            contents = replaceStaticLoader(contents, node.start, node.end);
          }
        }

        return { contents };
      });
    },
  };
}

function replaceStaticLoader(contents: string, start: number, end: number) {
  return (
    contents.slice(0, start) +
    '\nconst staticLoader = () => {};\n' +
    contents.slice(end)
  );
}
