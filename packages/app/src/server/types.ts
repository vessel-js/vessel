import type {
  AnyResponse,
  FetchMiddleware,
  InferResponseData,
  JSONData,
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
  router: any;
  route: ServerLoadedPageRoute;
  matches: ServerLoadedPageRoute[];
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

export type ServerFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<VesselResponse>;

export type ServerRedirect = {
  readonly path: string;
  readonly status: number;
};

// ---------------------------------------------------------------------------------------
// Server Manifest
// ---------------------------------------------------------------------------------------

export type ServerManifest = {
  production?: boolean;
  baseUrl: string;
  trailingSlash: boolean;
  entry: ServerEntryLoader;
  configs?: ServerConfig[];
  middlewares?: ServerMiddlewareEntry[];
  routes: {
    pages: ServerLoadablePageRoute[];
    api: ServerLoadableApiRoute[];
  };
  errorHandlers?: {
    page?: ServerErrorRoute[];
    api?: ServerErrorRoute[];
  };
  document: {
    entry: string;
    template: string;
    resources?: {
      all: ServerPageResource[];
      entry: ServerPageResourceEntry[];
      app: ServerPageResourceEntry[];
      routes: Record<string, ServerPageResourceEntry[]>;
    };
  };
  staticData: {
    /** Used client-side to fetch. Hashed data asset id to hashed content id. */
    clientHashRecord?: Record<string, string>;
    /** Used server-side to serialize data. Plain data asset id to hashed client id. */
    serverHashRecord?: Record<string, string>;
    /** Hashed client data asset id to dynamic data loader. */
    loaders?: Record<string, () => Promise<{ data: JSONData } | undefined>>;
  };
  dev?: {
    /**
     * Used in dev only to discover and inline styles _after_ modules have loaded. This ensures
     * Vite has had a chance to resolve module graph and discover stylesheets that are lazy. For
     * example, Svelte/Vue SFC styles are only determined after the module has run through Vite
     * resolution.
     */
    stylesheets?: () => Promise<string>;
    onPageRenderError?: (request: VesselRequest, error: unknown) => void;
    onApiError?: (request: VesselRequest, error: unknown) => void;
  };
};

export type ServerErrorRoute = Route & {
  readonly handler: ServerErrorHandler;
};

export type ServerErrorHandler = (
  request: VesselRequest,
  error: unknown,
) => void | AnyResponse | Promise<void | AnyResponse>;

export type ServerMiddlewareEntry = {
  readonly group?: string;
  readonly handler: FetchMiddleware;
};

// ---------------------------------------------------------------------------------------
// API Request Handler
// ---------------------------------------------------------------------------------------

export interface ServerApiRequestHandler<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
> {
  (event: ServerApiRequestEvent<Params>): Response | Promise<Response>;
  middleware?: (string | FetchMiddleware)[];
}

export type InferApiHandlerParams<T> = T extends ServerApiRequestHandler<
  infer Params
>
  ? Params
  : RequestParams;

export type InferApiHandlerData<T> = T extends ServerApiRequestHandler<
  never,
  infer Data
>
  ? InferResponseData<Data>
  : InferResponseData<T>;

// ---------------------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------------------

export type ServerApiModule = {
  [id: string]: ServerApiRequestHandler;
};

export type ServerLoadableApiRoute = Route & {
  readonly loader: () => Promise<ServerApiModule>;
  readonly methods?: string[];
};

export type ServerMatchedApiRoute = ServerLoadableApiRoute & RouteMatch;

export type ServerLoadedApiRoute = ServerMatchedApiRoute & {
  readonly module: ServerApiModule;
};

export type ServerApiRequestEvent<
  Params extends RequestParams = RequestParams,
> = RequestEvent<Params> & { serverFetch: ServerFetch };

export type ServerApiRequestEventInit<
  Params extends RequestParams = RequestParams,
> = RequestEventInit<Params> & { manifest: ServerManifest };

// ---------------------------------------------------------------------------------------
// Page Routes
// ---------------------------------------------------------------------------------------

export type ServerPageModule = {
  [id: string]: unknown;
  staticLoader?: StaticLoader;
  serverLoader?: ServerLoader;
  serverAction?: ServerAction;
};

export type ServerLoadablePageRoute = LoadableRoute<ServerPageModule>;

export type ServerMatchedPageRoute<
  Params extends RequestParams = RequestParams,
> = MatchedRoute<ServerPageModule, Params>;

export type ServerLoadedPageRoute<
  Params extends RequestParams = RequestParams,
> = LoadedRoute<ServerPageModule, Params>;

export type ServerPageRequestEventInit<
  Params extends RequestParams = RequestParams,
> = ServerApiRequestEventInit<Params> & { response?: VesselResponseInit };

export type ServerPageRequestEvent<
  Params extends RequestParams = RequestParams,
> = ServerApiRequestEvent<Params> & { response: VesselResponseInit };

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link}
 */
export type ServerPageResource = {
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
 * The number should point to a resource in a resource collection (i.e., `PageResource[]`). A
 * negative number means it's a dynamic import at the same absolute index.
 */
export type ServerPageResourceEntry = number;

// ---------------------------------------------------------------------------------------
// Server Loader
// ---------------------------------------------------------------------------------------

export interface ServerLoader<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
> {
  (event: ServerPageRequestEvent<Params>): Response | Promise<Response>;
  middleware?: (string | FetchMiddleware)[];
}

export type InferServerLoaderParams<T> = T extends ServerLoader<infer Params>
  ? Params
  : RequestParams;

export type InferServerLoaderData<T> = T extends ServerLoader<never, infer Data>
  ? InferResponseData<Data>
  : InferResponseData<T>;

// ---------------------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------------------

export type ServerAction<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
> = (event: ServerPageRequestEvent<Params>) => Response | Promise<Response>;

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

export type InferStaticLoaderParams<T> = T extends StaticLoader<infer Params>
  ? Params
  : RequestParams;

export type InferStaticLoaderData<T> = T extends StaticLoader<never, infer Data>
  ? Data
  : T;
