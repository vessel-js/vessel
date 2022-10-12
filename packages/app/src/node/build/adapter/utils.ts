import * as lexer from 'es-module-lexer';
import { Plugin as EsBuildPlugin } from 'esbuild';
import { parseAndReplaceVars } from 'node/utils/acorn';
import fs from 'node:fs/promises';

export function noopStaticLoader(): EsBuildPlugin {
  let installed = false;

  const noop = () => '() => {}',
    loaders = new Set(['staticLoader']);

  return {
    name: 'noop-static-loader',
    setup(build) {
      build.onStart(async () => {
        if (!installed) {
          await lexer.init;
          installed = true;
        }

        return null;
      });

      build.onLoad({ filter: /\.vessel\/server\/nodes/ }, async (args) => {
        const code = await fs.readFile(args.path, 'utf-8'),
          [, exports] = lexer.parse(code, args.path);

        if (!exports.some((specifier) => loaders.has(specifier.n))) {
          return { contents: code };
        }

        const result = parseAndReplaceVars(code, loaders, noop);
        return { contents: result.toString() };
      });
    },
  };
}
