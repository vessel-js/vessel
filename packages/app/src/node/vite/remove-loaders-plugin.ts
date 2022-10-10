/**
 * Adapted from: https://github.com/egoist/vite-plugin-remove-exports
 */

import * as lexer from 'es-module-lexer';
import esbuild from 'esbuild';
import type { App } from 'node/app/App';
import * as path from 'pathe';

import type { VesselPlugin } from './Plugin';

const VIRTUAL_ENTRY = '/__VIRTUAL_ENTRY__';

export function removeLoadersPlugin(): VesselPlugin {
  let app: App,
    installed = false;

  const loaderNames = new Set(['staticLoader', 'serverLoader', 'serverAction']);

  const loaderNoops = Array.from(loaderNames)
    .map((name) => `export const ${name} = () => {};`)
    .join('');

  return {
    name: '@vessel/remove-loaders',
    enforce: 'post',
    vessel: {
      configureApp(_app) {
        app = _app;
      },
    },
    async transform(code, id, { ssr } = {}) {
      const filePath = path.normalize(id);

      if (
        !ssr &&
        filePath.startsWith(app.dirs.app.path) &&
        app.files.routes.isDocumentFile(filePath)
      ) {
        if (!installed) {
          await lexer.init;
          installed = true;
        }

        const [, exports] = lexer.parse(code, id);

        const filteredNames = exports
          .map((specifier) => specifier.n)
          .filter((name) => !loaderNames.has(name));

        if (filteredNames.length === 0) return;

        const result = await esbuild.build({
          entryPoints: [VIRTUAL_ENTRY],
          bundle: true,
          format: 'esm',
          outdir: './never',
          write: false,
          sourcemap: true,
          plugins: [
            {
              name: 'remove-server-exports',
              setup(build) {
                build.onResolve({ filter: /.*/ }, (args) => {
                  if (args.path === id || args.path === VIRTUAL_ENTRY) {
                    return { path: args.path };
                  }

                  return { external: true };
                });

                build.onLoad({ filter: /.*/ }, (args) => {
                  if (args.path === VIRTUAL_ENTRY) {
                    const names = filteredNames.join(', ');
                    const contents = `${loaderNoops}\n\nexport { ${names} } from '${id}';`;
                    return { contents };
                  }

                  if (args.path === id) {
                    return { contents: code };
                  }

                  return; // TS being silly
                });
              },
            },
          ],
        });

        let jsCode = '';
        let map = '';

        for (const file of result.outputFiles) {
          if (file.path.endsWith('.js')) {
            jsCode = file.text;
          } else if (file.path.endsWith('.js.map')) {
            map = file.text;
          }
        }

        return {
          code: jsCode.replace(/^\/\/# sourceMappingURL=.+$/m, ''),
          map: map || undefined,
        };
      }

      return null;
    },
  };
}
