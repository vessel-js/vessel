/* eslint-disable prefer-rest-params */
import type {
  ServerErrorHandler,
  ServerErrorRoute,
  ServerHttpModule,
  ServerHttpRequestHandler,
  ServerLoadableHttpRoute,
  ServerMiddlewareEntry,
} from 'server/types';
import {
  type AnyResponse,
  type FetchMiddleware,
  type HttpMethod,
  redirect,
  type RequestParams,
} from 'shared/http';
import { calcRoutePathScore } from 'shared/routing';
import { isArray, isString } from 'shared/utils/unit';
import { noendslash } from 'shared/utils/url';

export function createServerRouter() {
  const middlewares: Omit<ServerMiddlewareEntry, 'pattern'>[] = [];

  const globalMiddleware = (handler: FetchMiddleware, group?: string) => {
    middlewares.push({ group, handler });
  };

  let globalErrorHandlerCount = 0;
  const errorHandlers: {
    document: Omit<ServerErrorRoute, 'pattern'>[];
    api: Omit<ServerErrorRoute, 'pattern'>[];
  } = {
    document: [],
    api: [],
  };

  const globalErrorHandler = (
    type: keyof typeof errorHandlers,
    path: string,
    handler: ServerErrorHandler,
  ) => {
    errorHandlers[type].push({
      id: `server_error_handler_${globalErrorHandlerCount++}`,
      score: calcRoutePathScore(path),
      pathname: path,
      handler,
    });
  };

  const httpRoutes: Omit<ServerLoadableHttpRoute, 'pattern'>[] = [];
  const existingHttpRoutes = new Map<
    string,
    { module: ServerHttpModule; methods: string[]; score: number }
  >();

  let httpRoutesCount = 0;
  const addHttpRoute = (
    methods: HttpMethod | HttpMethod[],
    path: string,
    handler: ServerHttpRequestHandler,
    rpcId = '',
    middlewares: (string | FetchMiddleware)[] = [],
  ) => {
    const existing = existingHttpRoutes.get(path);
    const module: ServerHttpModule = existing?.module ?? {};
    const normalizedMethods = isArray(methods) ? methods : [methods];
    const score = existing?.score ?? calcRoutePathScore(path);
    const allMethods = [...(existing?.methods ?? []), ...normalizedMethods];
    handler.middleware = [...(handler.middleware ?? []), ...middlewares];

    for (const method of normalizedMethods) {
      module[`${method}${rpcId}`] = handler;
    }

    httpRoutes.push({
      id: `server_http_route_${httpRoutesCount++}`,
      score,
      pathname: path,
      methods: allMethods,
      loader: () => Promise.resolve(module),
    });

    existingHttpRoutes.set(path, {
      module,
      score,
      methods: allMethods,
    });
  };

  const app: ServerApp = {
    middleware: {
      add: (handler) => {
        globalMiddleware(handler);
        return app.middleware;
      },
      group: (name) => {
        const newRouter: ServerApp['middleware'] = {
          ...app.middleware,
          add: (handler) => {
            globalMiddleware(handler, name);
            return newRouter;
          },
        };

        return newRouter;
      },
    },
    errors: {
      onDocumentRenderError: (...args) => {
        globalErrorHandler('document', ...args);
        return app.errors;
      },
      onApiError: (...args) => {
        globalErrorHandler('api', ...args);
        return app.errors;
      },
    },
  };

  const createRouteManager = (
    prefix = '',
    middlewares: (string | FetchMiddleware)[] = [],
  ) => {
    const _prefix = noendslash(prefix);

    const router: ServerRouter = {
      middleware: (group: string | FetchMiddleware) => {
        return createRouteManager(_prefix, [...middlewares, group]);
      },
      prefix: (nextPrefix) => {
        return createRouteManager(`${_prefix}${nextPrefix}`, [...middlewares]);
      },
      redirect: (from, to, init) => {
        addHttpRoute(
          ['GET', 'HEAD'],
          `${_prefix}${from}`,
          () => redirect(to, init),
          undefined,
          middlewares,
        );
        return router;
      },
      http: (method, path, handler) => {
        const _path = isString(path) ? path : path.path;
        const rpcId = isString(path) ? undefined : path.rpcId;
        addHttpRoute(
          method,
          `${_prefix}${_path}`,
          handler as any,
          rpcId,
          middlewares,
        );
        return router;
      },
    };

    return router;
  };

  return {
    app,
    router: createRouteManager(),
    middlewares,
    errorHandlers,
    httpRoutes,
  };
}

export type ServerApp = {
  middleware: {
    group(name: string): Omit<ServerApp['middleware'], 'group'>;
    add(handler: FetchMiddleware): ServerApp['middleware'];
  };

  errors: {
    onDocumentRenderError: (
      path: `/${string}`,
      handler: ServerErrorHandler,
    ) => ServerApp['errors'];
    onApiError: (
      path: `/${string}`,
      handler: ServerErrorHandler,
    ) => ServerApp['errors'];
  };
};

export type ServerRouter = {
  middleware(handler: FetchMiddleware): ServerRouter;
  middleware(group: string): ServerRouter;

  prefix(prefix: `/${string}`): ServerRouter;

  redirect(
    from: `/${string}`,
    to: `/${string}`,
    init?: number | ResponseInit,
  ): ServerRouter;

  http<
    Params extends RequestParams = RequestParams,
    Response extends AnyResponse = AnyResponse,
  >(
    methods: HttpMethod | HttpMethod[],
    path: `/${string}` | { path: `/${string}`; rpcId: string },
    handler: ServerHttpRequestHandler<Params, Response>,
  ): ServerRouter;
};
