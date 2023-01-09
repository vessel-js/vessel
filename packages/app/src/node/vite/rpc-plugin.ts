import * as lexer from 'es-module-lexer';
import type { App } from 'node/app/App';
import * as path from 'pathe';
import { HTTP_METHOD_RE, HTTP_METHODS, resolveHandlerHttpMethod } from 'shared/http';

import type { VesselPlugin } from './Plugin';

export function rpcPlugin(): VesselPlugin {
  let app: App,
    installed = false;

  return {
    name: '@vessel/rpc',
    enforce: 'post',
    vessel: {
      configureApp(_app) {
        app = _app;
      },
    },
    async transform(code, id, { ssr } = {}) {
      const filePath = path.normalize(id);

      if (filePath.startsWith(app.dirs.app.path) && app.files.routes.isApiFile(filePath)) {
        if (!installed) {
          await lexer.init;
          installed = true;
        }

        const handlers: [id: string, method: string, path: string][] = [];
        const routeFile = app.files.routes.find(filePath)!;
        const routeId = app.routes.find(routeFile)!.id;

        const addHandler = (handlerId: string) => {
          const method = resolveHandlerHttpMethod(handlerId);
          if (method) {
            const isNamedHandler = !HTTP_METHODS.has(handlerId);

            const rpcHandlerId = isNamedHandler
              ? `&rpc_handler_id=${encodeURIComponent(handlerId)}`
              : '';

            handlers.push([
              handlerId,
              method.toUpperCase(),
              `/__rpc?rpc_route_id=${encodeURIComponent(routeId)}${rpcHandlerId}`,
            ]);
          }
        };

        const [, exports] = lexer.parse(code, id);

        for (const specifier of exports) {
          if (HTTP_METHOD_RE.test(specifier.n)) {
            addHandler(specifier.n);
          }
        }

        return !ssr
          ? handlers
              .map(
                ([handlerId, method, path]) =>
                  `export const ${handlerId} = ['${method}', '${path}'];`,
              )
              .join('\n')
          : code +
              '\n\n' +
              handlers
                .map(([handlerId, method, path]) => `${handlerId}.rpc = ['${method}', '${path}'];`)
                .join('\n');
      }

      return null;
    },
  };
}
