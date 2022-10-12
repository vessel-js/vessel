import * as lexer from 'es-module-lexer';
import type { App } from 'node/app/App';
import { parseAndReplaceVars } from 'node/utils/acorn';
import * as path from 'pathe';

import type { VesselPlugin } from './Plugin';

export function removeLoadersPlugin(): VesselPlugin {
  let app: App,
    installed = false;

  const validLoaders = new Set([
    'staticLoader',
    'serverLoader',
    'serverAction',
  ]);

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

        const filteredLoaders = exports
          .map((specifier) => specifier.n)
          .filter((name) => validLoaders.has(name));

        if (filteredLoaders.length === 0) return;

        const loaders = new Set(filteredLoaders),
          result = parseAndReplaceVars(code, loaders, () => '() => {}');

        return {
          code: result.toString(),
          map: result.generateMap({ source: id }),
        };
      }

      return null;
    },
  };
}
