import * as lexer from 'es-module-lexer';
import type { App } from 'node/app/App';
import * as path from 'pathe';
import {
  HTTP_METHOD_RE,
  HTTP_METHODS,
  resolveHandlerHttpMethod,
} from 'shared/http';

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

      if (
        !ssr &&
        filePath.startsWith(app.dirs.app.path) &&
        app.files.routes.isHttpFile(filePath)
      ) {
        if (!installed) {
          await lexer.init;
          installed = true;
        }

        const handlers: string[] = [];
        const routeFile = app.files.routes.find(filePath)!;
        const routeId = app.routes.find(routeFile)!.id;

        const addHandler = (handlerId: string) => {
          const method = resolveHandlerHttpMethod(handlerId);
          if (method) {
            const isNamedHandler = !HTTP_METHODS.has(handlerId);

            const rpcHandlerId = isNamedHandler
              ? `&rpc_handler_id=${handlerId}`
              : '';

            const rpcIdExport = `export const ${handlerId} = [${[
              `'${method.toUpperCase()}'`,
              `'/__rpc?rpc_route_id=${routeId}${rpcHandlerId}'`,
            ].join(', ')}];`;

            handlers.push(rpcIdExport);
          }
        };

        const result = lexer.parse(code, id);

        result[1]
          .map((s) => s.n)
          .forEach((id) => HTTP_METHOD_RE.test(id) && addHandler(id));

        return handlers.join('\n\n');
      }

      return null;
    },
  };
}
