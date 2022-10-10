/* eslint-disable prefer-rest-params */
import type {
  ServerApiModule,
  ServerApiRequestHandler,
  ServerErrorHandler,
  ServerErrorRoute,
  ServerLoadableApiRoute,
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
import { isArray } from 'shared/utils/unit';
import { noendslash, slash } from 'shared/utils/url';

export function createServerRouter() {
  const middlewares: Omit<ServerMiddlewareEntry, 'pattern'>[] = [];

  const globalMiddleware = (handler: FetchMiddleware, group?: string) => {
    middlewares.push({ group, handler });
  };

  const errorHandlers: {
    page: Omit<ServerErrorRoute, 'pattern'>[];
    api: Omit<ServerErrorRoute, 'pattern'>[];
  } = {
    page: [],
    api: [],
  };

  const globalErrorHandler = (
    type: keyof typeof errorHandlers,
    path: string,
    handler: ServerErrorHandler,
  ) => {
    errorHandlers[type].push({
      id: path,
      score: calcRoutePathScore(path),
      pathname: path,
      handler,
    });
  };

  const apiRoutes: Omit<ServerLoadableApiRoute, 'pattern'>[] = [];

  const apiRoutesCache = new Map<
    string,
    { module: ServerApiModule; methods: string[] }
  >();

  const addHttpRoute = (
    methods: HttpMethod | HttpMethod[],
    path: string,
    handler: ServerApiRequestHandler,
    rpcId = '',
    middlewares: (string | FetchMiddleware)[] = [],
  ) => {
    path = path === '/' ? path : noendslash(path);

    const cached = apiRoutesCache.get(path);
    const cachedMethods = cached?.methods ?? [];

    const module: ServerApiModule = cached?.module ?? {};
    const normalizedMethods = isArray(methods) ? methods : [methods];

    const allMethods = [
      ...cachedMethods,
      ...normalizedMethods.filter((method) => !cachedMethods.includes(method)),
    ];

    handler.middleware = [...(handler.middleware ?? []), ...middlewares];

    for (const method of normalizedMethods) {
      module[`${method}${rpcId}`] = handler;
    }

    if (!cached) {
      apiRoutes.push({
        id: path,
        score: calcRoutePathScore(path),
        pathname: path,
        methods: allMethods,
        loader: () => Promise.resolve(module),
      });
    } else {
      cached.methods.splice(0, cached.methods.length, ...allMethods);
    }

    apiRoutesCache.set(path, { module, methods: allMethods });
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
      onPageRenderError: (...args) => {
        globalErrorHandler('page', ...args);
        return app.errors;
      },
      onApiError: (...args) => {
        globalErrorHandler('api', ...args);
        return app.errors;
      },
    },
  };

  let basePrefix = '/api';

  const createRouteManager = (
    prefix = '',
    middlewares: (string | FetchMiddleware)[] = [],
  ) => {
    const _prefix = noendslash(prefix);

    const router: ServerRouter = {
      get basePrefix() {
        return basePrefix as `/${string}`;
      },
      set basePrefix(prefix) {
        basePrefix = noendslash(slash(prefix));
      },
      middleware: (group: string | FetchMiddleware) => {
        return createRouteManager(_prefix, [...middlewares, group]);
      },
      prefix: (nextPrefix) => {
        return createRouteManager(`${basePrefix}${_prefix}${nextPrefix}`, [
          ...middlewares,
        ]);
      },
      redirect: (from, to, init) => {
        addHttpRoute(
          ['GET', 'HEAD'],
          `${basePrefix}${_prefix}${from}`,
          () => redirect(to, init),
          undefined,
          middlewares,
        );
        return router;
      },
      http: (method, path, handler) => {
        addHttpRoute(
          method,
          `${basePrefix}${_prefix}${path}`,
          handler as any,
          undefined,
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
    apiRoutes,
  };
}

export type ServerApp = {
  middleware: {
    group(name: string): Omit<ServerApp['middleware'], 'group'>;
    add(handler: FetchMiddleware): ServerApp['middleware'];
  };

  errors: {
    onPageRenderError: (
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
  basePrefix: `/${string}`;

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
    path: `/${string}`,
    handler: ServerApiRequestHandler<Params, Response>,
  ): ServerRouter;
};
