import type { App } from 'node/app/App';
import * as path from 'pathe';
import {
  HTTP_METHOD_RE,
  HTTP_METHODS,
  resolveHandlerHttpMethod,
} from 'shared/http';
import t from 'typescript';

import type { VesselPlugin } from './Plugin';

export function rpcPlugin(): VesselPlugin {
  let app: App;

  const isRequestHandlerExport = (
    node: t.Node,
  ): node is t.VariableStatement | t.FunctionDeclaration =>
    (t.isVariableStatement(node) || t.isFunctionDeclaration(node)) &&
    (t.getCombinedModifierFlags(node as t.Declaration) &
      t.ModifierFlags.Export) !==
      0;

  return {
    name: '@vessel/rpc',
    enforce: 'pre',
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
        const handlers: string[] = [];
        const routeFile = app.files.routes.find(filePath)!;
        const routeId = app.routes.find(routeFile)!.id;
        const sourceFile = t.createSourceFile(id, code, 99, false);

        const addHandler = (root: t.Node, handlerId: string) => {
          const method = resolveHandlerHttpMethod(handlerId);
          if (method) {
            const isNamedHandler = !HTTP_METHODS.has(handlerId);

            const rpcHandlerId = isNamedHandler
              ? `&rpc_handler_id=${handlerId}`
              : '';

            const rpcIdExport = `export const ${handlerId} = [${[
              `'/__rpc?rpc_route_id=${routeId}${rpcHandlerId}'`,
              `'${method.toUpperCase()}'`,
            ].join(', ')}];`;

            handlers.push(rpcIdExport);
          }
        };

        t.forEachChild(sourceFile, (node) => {
          if (isRequestHandlerExport(node)) {
            if (t.isFunctionDeclaration(node)) {
              const handlerId = node.name?.escapedText;
              if (handlerId && HTTP_METHOD_RE.test(handlerId)) {
                addHandler(node, handlerId);
              }
            } else {
              const declaration = node.declarationList.declarations[0];
              if (
                declaration &&
                declaration.initializer &&
                (t.isArrowFunction(declaration.initializer) ||
                  t.isCallExpression(declaration.initializer))
              ) {
                const handlerId = (declaration.name as t.Identifier)
                  ?.escapedText;
                if (handlerId && HTTP_METHOD_RE.test(handlerId)) {
                  addHandler(node, handlerId);
                }
              }
            }
          }
        });

        return handlers.join('\n\n');
      }

      return null;
    },
  };
}
