import type {
  AnyResponse,
  FetchMiddleware,
  JSONData,
  JSONResponse,
  RequestEvent,
  RequestEventInit,
  RequestParams,
  VesselRequest,
  VesselResponse,
  VesselResponseInit,
} from 'shared/http';
import type {
  LoadableRoute,
  LoadedRoute,
  MatchedRoute,
  Route,
  RouteMatch,
} from 'shared/routing';

import type { ServerConfig } from './http/app/configure-server';

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
  body?: string;
  bodyAttrs?: string;
  htmlAttrs?: string;
};

// ---------------------------------------------------------------------------------------
// Server Manifest
// ---------------------------------------------------------------------------------------

export type ServerManifest = {
  dev?: boolean;
  baseUrl: string;
  trailingSlash: boolean;
  entry: ServerEntryLoader;
  configs?: ServerConfig[];
  middlewares?: ServerMiddlewareEntry[];
  routes: {
    document: ServerLoadableRoute[];
    http: ServerLoadableHttpRoute[];
  };
  errorHandlers?: {
    document?: ServerErrorRoute[];
    api?: ServerErrorRoute[];
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
    /** Used client-side to fetch. Hashed data asset id to hashed content id. */
    clientHashRecord: Record<string, string>;
    /** Used server-side to serialize data. Plain data asset id to hashed client id. */
    serverHashRecord: Record<string, string>;
    /** Hashed client data asset id to dynamic data loader. */
    loaders: Record<string, () => Promise<{ data: JSONData } | undefined>>;
  };
  devHooks?: {
    onDocumentRenderError?: (request: VesselRequest, error: unknown) => void;
    onUnexpectedHttpError?: (request: VesselRequest, error: unknown) => void;
  };
};

export type ServerMiddlewareEntry = {
  readonly group?: string;
  readonly handler: FetchMiddleware;
};

export type ServerErrorRoute = Route & {
  readonly handler: ServerErrorHandler;
};

export type ServerErrorHandler = (
  request: VesselRequest,
  error: unknown,
) => void | AnyResponse | Promise<void | AnyResponse>;

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
 * The number should point to a resource in a resource collection (i.e., `DocumentResource[]`). A
 * negative number means it's a dynamic import at the same absolute index.
 */
export type DocumentResourceEntry = number;

// ---------------------------------------------------------------------------------------
// Server Route
// ---------------------------------------------------------------------------------------

export type ServerModule = {
  [id: string]: unknown;
  staticLoader?: StaticLoader;
  serverLoader?: ServerLoader;
  serverAction?: ServerAction;
};

export type ServerLoadableRoute = LoadableRoute<ServerModule>;

export type ServerMatchedRoute<Params extends RequestParams = RequestParams> =
  MatchedRoute<ServerModule, Params>;

export type ServerLoadedRoute<Params extends RequestParams = RequestParams> =
  LoadedRoute<ServerModule, Params>;

// ---------------------------------------------------------------------------------------
// Server HTTP Route
// ---------------------------------------------------------------------------------------

export type ServerHttpModule = {
  [id: string]: HttpRequestHandler;
};

export type ServerLoadableHttpRoute = Route & {
  readonly loader: () => Promise<ServerHttpModule>;
  readonly methods?: string[];
};

export type ServerMatchedHttpRoute = ServerLoadableHttpRoute & RouteMatch;

export type ServerLoadedHttpRoute = ServerMatchedHttpRoute & {
  readonly module: ServerHttpModule;
};

export type ServerRedirect = {
  readonly path: string;
  readonly status: number;
};

// ---------------------------------------------------------------------------------------
// Server Request Events
// ---------------------------------------------------------------------------------------

export type ServerFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<VesselResponse>;

export type HttpRequestEvent<Params extends RequestParams = RequestParams> =
  RequestEvent<Params> & { serverFetch: ServerFetch };

export type HttpRequestEventInit<Params extends RequestParams = RequestParams> =
  RequestEventInit<Params> & { manifest?: ServerManifest };

export type DocumentRequestEventInit<
  Params extends RequestParams = RequestParams,
> = HttpRequestEventInit<Params> & { response?: VesselResponseInit };

export type DocumentRequestEvent<Params extends RequestParams = RequestParams> =
  HttpRequestEvent<Params> & { response: VesselResponseInit };

// ---------------------------------------------------------------------------------------
// HTTP Request Handler
// ---------------------------------------------------------------------------------------

export interface HttpRequestHandler<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
> {
  (event: HttpRequestEvent<Params>): Response | Promise<Response>;
  middleware?: (string | FetchMiddleware)[];
}

export type InferHttpHandlerParams<Handler> =
  Handler extends HttpRequestHandler<infer T> ? T : RequestParams;

export type InferHttpHandlerData<Handler> =
  // eslint-disable-next-line @typescript-eslint/ban-types
  Handler extends HttpRequestHandler<{}, infer T>
    ? T extends Response
      ? T extends JSONResponse<infer Data>
        ? Data
        : unknown
      : T
    : unknown;

// ---------------------------------------------------------------------------------------
// Server Loader
// ---------------------------------------------------------------------------------------

export interface ServerLoader<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
> {
  (event: DocumentRequestEvent<Params>): Response | Promise<Response>;
  middleware?: (string | FetchMiddleware)[];
}

// ---------------------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------------------

export type ServerAction<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
> = (event: DocumentRequestEvent<Params>) => Response | Promise<Response>;

// ---------------------------------------------------------------------------------------
// Static Loader
// ---------------------------------------------------------------------------------------

export type StaticLoaderEvent<Params extends RequestParams = RequestParams> =
  Readonly<{
    pathname: string;
    route: Route;
    params: Params;
    serverFetch: ServerFetch;
  }>;

/** Map of data asset id to server loaded data objects. */
export type StaticLoaderDataMap = Map<string, JSONData>;

/** Key can be anything but only truthy values are cached. */
export type StaticLoaderCacheKey = unknown;

export type StaticLoaderCacheMap = Map<
  StaticLoaderCacheKey,
  StaticLoaderResponse
>;

export type StaticLoaderCacheKeyBuilder = (
  event: StaticLoaderEvent,
) => StaticLoaderCacheKey | Promise<StaticLoaderCacheKey>;

export type StaticLoader<
  Params extends RequestParams = RequestParams,
  Data extends JSONData = JSONData,
> = (
  event: StaticLoaderEvent<Params>,
) => MaybeStaticLoaderResponse<Data> | Promise<MaybeStaticLoaderResponse<Data>>;

export type MaybeStaticLoaderResponse<Data = JSONData> =
  | void
  | undefined
  | null
  | StaticLoaderResponse<Data>;

export type StaticLoaderResponse<Data = JSONData> = {
  data?: Data;
  readonly redirect?: string | { path: string; status?: number };
  readonly cache?: StaticLoaderCacheKeyBuilder;
};
