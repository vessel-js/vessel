import { getRouteComponentTypes, stripRouteComponentTypes } from './match';
import type { MatchedRoute, RouteComponentType } from './types';

export type RouteLoadResult<
  Route extends MatchedRoute,
  StaticDataLoadResult,
  ServerDataLoadResult,
> = Omit<Route, RouteComponentType> & {
  [P in RouteComponentType]?: {
    module: PromiseSettledResult<Required<Route>['__moduleType']>;
    staticData: PromiseSettledResult<StaticDataLoadResult>;
    serverData: PromiseSettledResult<ServerDataLoadResult>;
  };
};

export async function loadRoute<
  Route extends MatchedRoute,
  StaticDataLoadResult,
  ServerDataLoadResult,
>(
  url: URL,
  route: Route,
  staticDataLoader: RouteDataLoader<Route, StaticDataLoadResult>,
  serverDataLoader: RouteDataLoader<Route, ServerDataLoadResult>,
) {
  const result: RouteLoadResult<
    Route,
    StaticDataLoadResult,
    ServerDataLoadResult
  > = stripRouteComponentTypes(route);

  await Promise.all(
    getRouteComponentTypes()
      .filter((type) => route[type])
      .map(async (type) => {
        const [mod, staticData, serverData] = await Promise.allSettled([
          route[type]!.loader(),
          staticDataLoader(url, route, type),
          serverDataLoader(url, route, type),
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
  StaticDataLoadResult,
  ServerDataLoadResult,
>(
  url: URL,
  routes: Route[],
  staticDataLoader: RouteDataLoader<Route, StaticDataLoadResult>,
  serverDataLoader: RouteDataLoader<Route, ServerDataLoadResult>,
): Promise<
  RouteLoadResult<Route, StaticDataLoadResult, ServerDataLoadResult>[]
> {
  return Promise.all(
    routes.map((route) =>
      loadRoute(url, route, staticDataLoader, serverDataLoader),
    ),
  );
}

export type RouteDataLoader<Route extends MatchedRoute, LoadResult> = (
  url: URL,
  route: Route,
  type: RouteComponentType,
) => Promise<LoadResult>;
