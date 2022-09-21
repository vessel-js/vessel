import { getRouteComponentTypes, stripRouteComponentTypes } from './match';
import type { MatchedRoute, RouteComponentType } from './types';

export type LoadRouteResult<
  Route extends MatchedRoute,
  LoadStaticDataResult,
  LoadServerDataResult,
> = Omit<Route, RouteComponentType> & {
  [P in RouteComponentType]?: {
    module: PromiseSettledResult<Required<Route>['__moduleType']>;
    staticData: PromiseSettledResult<LoadStaticDataResult>;
    serverData: PromiseSettledResult<LoadServerDataResult>;
  };
};

export async function loadRoute<
  Route extends MatchedRoute,
  LoadStaticDataResult,
  LoadServerDataResult,
>(
  url: URL,
  route: Route,
  staticDataLoader: RouteDataLoader<Route, LoadStaticDataResult>,
  serverDataLoader: RouteDataLoader<Route, LoadServerDataResult>,
  signal?: AbortSignal,
) {
  const result: LoadRouteResult<
    Route,
    LoadStaticDataResult,
    LoadServerDataResult
  > = stripRouteComponentTypes(route);

  await Promise.all(
    getRouteComponentTypes()
      .filter((type) => route[type])
      .map(async (type) => {
        // @ts-expect-error - .
        const loadedMod = route[type]?.module;

        const [mod, staticData, serverData] = await Promise.allSettled([
          loadedMod ? Promise.resolve(loadedMod) : route[type]!.loader(),
          staticDataLoader(new URL(url), route, type, signal),
          serverDataLoader(new URL(url), route, type, signal),
        ]);

        result[type] = {
          module: mod,
          staticData,
          serverData,
        };
      }),
  );

  return result;
}

export async function loadRoutes<
  Route extends MatchedRoute,
  LoadStaticDataResult,
  LoadServerDataResult,
>(
  url: URL,
  routes: Route[],
  staticDataLoader: RouteDataLoader<Route, LoadStaticDataResult>,
  serverDataLoader: RouteDataLoader<Route, LoadServerDataResult>,
  signal?: AbortSignal,
): Promise<
  LoadRouteResult<Route, LoadStaticDataResult, LoadServerDataResult>[]
> {
  return Promise.all(
    routes.map((route) =>
      loadRoute(url, route, staticDataLoader, serverDataLoader, signal),
    ),
  );
}

export type RouteDataLoader<Route extends MatchedRoute, LoadResult> = (
  url: URL,
  route: Route,
  type: RouteComponentType,
  signal?: AbortSignal,
) => Promise<LoadResult>;

export function resolveSettledPromiseValue<T>(
  result?: PromiseSettledResult<T>,
) {
  return result?.status === 'fulfilled' ? result.value : null;
}

export function resolveSettledPromiseRejection(
  result?: PromiseSettledResult<unknown>,
) {
  return result?.status === 'rejected' ? result.reason : null;
}
