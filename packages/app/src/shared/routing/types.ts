import type { HttpError } from '../http/errors';

export type Route = {
  /**
   * A unique value used to identify this route (i.e., URI).
   */
  readonly id: string;
  /**
   * A positive integer representing the path match ranking. The route with the highest score
   * will win if the path matches multiple routes.
   */
  readonly score: number;
  /**
   * The `pathname` is the string used to the construct the `URLPattern`.
   */
  readonly pathname: string;
  /**
   * `URLPattern` used to match a pattern against a URL.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API}
   */
  readonly pattern: URLPattern;
  /**
   * Whether the route pattern is dynamic. This includes wildcards `*`, named groups `/:id`,
   * non-capturing groups `{/path}` and RegExp groups `(\\d+)`.
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API#pattern_syntax}
   */
  readonly dynamic?: boolean;
};

export type RouteModule = {
  [id: string]: unknown;
};

export type LoadableRouteComponent<Module extends RouteModule = RouteModule> = {
  /**
   * Called when the current route is being navigated to. Generally this should return a JS
   * module.
   */
  readonly loader: () => Promise<Module>;
  /**
   * Whether this route can fetch data from the server. This is is `true` if a page has defined a
   * `serverLoader`. In dev mode it will attempt a fetch regardless.
   */
  readonly canFetch?: boolean;
  /**
   * Used client-side to determine whether the data is still valid.
   */
  dataValid?: boolean;
};

export type RouteComponentType = 'page' | 'layout' | 'errorBoundary';

export type LoadableRoute<Module extends RouteModule = RouteModule> = Route & {
  readonly __moduleType?: Module;
} & {
  readonly [P in RouteComponentType]?: LoadableRouteComponent<Module>;
};

export type RouteMatch<Params extends RouteParams = RouteParams> = {
  readonly matchedURL: URL;
  readonly params: Params;
};

export type MatchedRoute<
  Module extends RouteModule = RouteModule,
  Params extends RouteParams = RouteParams,
> = LoadableRoute<Module> & RouteMatch<Params>;

export type LoadedStaticData = Record<string, any>;
export type LoadedServerData = any;

export type LoadedRouteData = {
  readonly staticData?: LoadedStaticData;
  readonly serverData?: LoadedServerData;
  readonly serverLoadError?: HttpError;
};

export type LoadedRouteComponent<Module extends RouteModule = RouteModule> =
  LoadableRouteComponent<Module> & {
    readonly module: Module;
    /**
     * Used client-side to determine whether the data is still valid.
     */
    dataValid?: boolean;
  } & LoadedRouteData;

export type LoadedRoute<
  Module extends RouteModule = RouteModule,
  Params extends RouteParams = RouteParams,
> = Route &
  RouteMatch<Params> & {
    readonly [P in RouteComponentType]?: LoadedRouteComponent<Module>;
  } & {
    /**
     * Any unexpected error that was thrown during rendering or data loading.
     */
    error?: Error;
  };

export type RouteParams = {
  [param: string]: string | undefined;
};
