import type {
  LoadableRoute,
  LoadedRoute,
  MatchedRoute,
  Route,
  RouteComponentType,
  RouteMatch,
} from 'shared/routing';

import type {
  HttpRequestModule,
  RequestEvent,
  RequestParams,
} from './http/request';
import type { JSONData } from './http/response';

// ---------------------------------------------------------------------------------------
// Server Module
// ---------------------------------------------------------------------------------------

export type ServerModule = {
  [id: string]: unknown;
  staticLoader?: StaticLoader;
  serverLoader?: ServerLoader;
  serverAction?: ServerAction;
};

// ---------------------------------------------------------------------------------------
// Server Entry
// ---------------------------------------------------------------------------------------

export type ServerEntryContext = {
  route: ServerLoadedRoute;
  router: any;
  matches: ServerLoadedRoute[];
};

export type ServerEntryModule = {
  [id: string]: unknown;
  render: ServerRenderer;
};

export type ServerEntryLoader = () => Promise<ServerEntryModule>;

export type ServerRenderer = (
  context: ServerEntryContext,
) => Promise<ServerRenderResult>;

export type ServerRenderResult = {
  head?: string;
  css?: string;
  html: string;
};

// ---------------------------------------------------------------------------------------
// Server Manifest
// ---------------------------------------------------------------------------------------

export type ServerManifest = {
  dev?: boolean;
  baseUrl: string;
  trailingSlash: boolean;
  entry: ServerEntryLoader;
  routes: {
    app: ServerLoadableRoute[];
    http: ServerLoadableHttpRoute[];
  };
  document: {
    entry: string;
    template: string;
    resources: {
      all: DocumentResource[];
      entry: DocumentResourceEntry[];
      app: DocumentResourceEntry[];
      routes: Record<string, DocumentResourceEntry[]>;
    };
    /**
     * Used in dev only to discover and inline styles _after_ modules have loaded. This ensures
     * Vite has had a chance to resolve module graph and discover stylesheets that are lazy. For
     * example, Svelte/Vue SFC styles are only determined after the module has run through Vite
     * resolution.
     */
    devStylesheets?: () => Promise<string>;
  };
  staticData: {
    loader: StaticDataLoader;
    hashMap: string;
    hashRecord?: Record<string, string>;
  };
};

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link}
 */
export type DocumentResource = {
  href: string;
  rel?: 'prefetch' | 'preload' | 'modulepreload' | 'stylesheet';
  as?:
    | 'audio'
    | 'video'
    | 'image'
    | 'fetch'
    | 'font'
    | 'script'
    | 'style'
    | 'track'
    | 'worker';
  type?: string;
  crossorigin?: boolean;
};

/**
 * - `index` should point to a resource in a resource collection (i.e., `DocumentResource[]`).
 * - `dynamic` refers to lazy loaded modules/assets (i.e., dynamically imported).
 */
export type DocumentResourceEntry = {
  index: number;
  dynamic?: boolean;
};

// ---------------------------------------------------------------------------------------
// Server Route
// ---------------------------------------------------------------------------------------

export type ServerLoadableRoute = LoadableRoute<ServerModule>;

export type ServerMatchedRoute<Params extends RequestParams = RequestParams> =
  MatchedRoute<ServerModule, Params>;

export type ServerLoadedRoute<Params extends RequestParams = RequestParams> =
  LoadedRoute<ServerModule, Params>;

// ---------------------------------------------------------------------------------------
// Server HTTP Route
// ---------------------------------------------------------------------------------------

export type ServerLoadableHttpRoute = Route & {
  readonly loader: () => Promise<HttpRequestModule>;
};

export type ServerMatchedHttpRoute = ServerLoadableHttpRoute & RouteMatch;

export type ServerLoadedHttpRoute = ServerMatchedHttpRoute & {
  readonly module: HttpRequestModule;
};

export type ServerRequestHandler = (request: Request) => Promise<Response>;

export type ServerRedirect = {
  readonly path: string;
  readonly status: number;
};

// ---------------------------------------------------------------------------------------
// Static Loader
// ---------------------------------------------------------------------------------------

export type StaticDataLoader = (
  url: URL,
  route: ServerMatchedRoute,
  type: RouteComponentType,
) => Promise<JSONData | undefined>;

export type StaticLoaderInput<Params extends RequestParams = RequestParams> =
  Readonly<{
    pathname: string;
    route: Route;
    params: Params;
    fetcher: ServerFetcher;
  }>;

/** Map of data asset id to server loaded data objects. */
export type StaticLoaderDataMap = Map<string, JSONData>;

/** Key can be anything but only truthy values are cached. */
export type StaticLoaderCacheKey = unknown;

export type StaticLoaderCacheMap = Map<
  StaticLoaderCacheKey,
  StaticLoaderOutput
>;

export type StaticLoaderCacheKeyBuilder = (
  input: StaticLoaderInput,
) => StaticLoaderCacheKey | Promise<StaticLoaderCacheKey>;

export type StaticLoader<
  Params extends RequestParams = RequestParams,
  Data extends JSONData = JSONData,
> = (
  input: StaticLoaderInput<Params>,
) => MaybeStaticLoaderOutput<Data> | Promise<MaybeStaticLoaderOutput<Data>>;

export type StaticLoaderOutput<Data = JSONData> = {
  data?: Data;
  readonly redirect?: string | { path: string; status?: number };
  readonly cache?: StaticLoaderCacheKeyBuilder;
};

export type ServerFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type MaybeStaticLoaderOutput<Data = JSONData> =
  | void
  | undefined
  | null
  | StaticLoaderOutput<Data>;

// ---------------------------------------------------------------------------------------
// Server Loader
// ---------------------------------------------------------------------------------------

export type ServerLoader<Params extends RequestParams = RequestParams> = (
  event: RequestEvent<Params>,
) => ServerLoaderOutput | Promise<ServerLoaderOutput>;

export type ServerLoaderOutput = Response | JSONData;

// ---------------------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------------------

export type ServerAction<Params extends RequestParams = RequestParams> = (
  event: RequestEvent<Params>,
) => ServerLoaderOutput | Promise<ServerLoaderOutput>;
