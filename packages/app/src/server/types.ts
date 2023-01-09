import type {
  AnyResponse,
  ClientFetchInit,
  FetchMiddleware,
  InferAnyResponseData,
  JSONData,
  JSONResponse,
  RequestParams,
  ResponseDetails,
  RPCFetchInfo,
  RPCHandler,
  VesselJSONResponse,
  VesselRequest,
  VesselResponse,
} from 'shared/http';
import type { LoadableRoute, LoadedRoute, MatchedRoute, Route, RouteMatch } from 'shared/routing';

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

export type ServerRenderer = (context: ServerEntryContext) => Promise<ServerRenderResult>;

export type ServerRenderResult = {
  head?: string;
  css?: string;
  html: string;
  body?: string;
  bodyAttrs?: string;
  htmlAttrs?: string;
};

export type ServerFetch = <RPC extends RPCHandler>(
  input: RequestInfo | URL | RPC,
  init?: ServerFetchInit<InferServerFetchParams<RPC>>,
) => Promise<InferServerFetchResponse<RPC>>;

export type ServerFetchInit<Params extends RequestParams = RequestParams> = ClientFetchInit<Params>;

export type InferServerFetchParams<RPC extends RPCHandler> = InferServerRequestHandlerParams<RPC>;

export type InferServerFetchResponse<RPC extends RPCHandler> = RPC extends ServerRequestHandler<
  any,
  infer Response
>
  ? Response extends JSONResponse<infer Data>
    ? VesselJSONResponse<Data>
    : VesselResponse
  : VesselResponse;

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
// Request Event
// ---------------------------------------------------------------------------------------

export type ServerRequestEvent<Params extends RequestParams = RequestParams> = {
  request: VesselRequest;
  params: Params;
  response: ResponseDetails;
  page?: ResponseDetails;
  serverFetch: ServerFetch;
};

export type ServerRequestEventInit<Params extends RequestParams = RequestParams> = {
  request: VesselRequest;
  params: Params;
  page?: ResponseDetails;
  manifest: ServerManifest;
};

// ---------------------------------------------------------------------------------------
// Request Handler
// ---------------------------------------------------------------------------------------

export interface ServerRequestHandler<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
> {
  (event: ServerRequestEvent<Params>): Response | Promise<Response>;
  middleware?: (string | FetchMiddleware)[];
  rpc?: RPCFetchInfo;
}

export type InferServerRequestHandlerParams<T> = T extends ServerRequestHandler<infer Params>
  ? Params
  : RequestParams;

export type InferServerRequestHandlerData<T> = T extends ServerRequestHandler<never, infer Data>
  ? InferAnyResponseData<Data>
  : InferAnyResponseData<T>;

// ---------------------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------------------

export type ServerApiModule = {
  [id: string]: ServerRequestHandler;
};

export type ServerLoadableApiRoute = Route & {
  readonly loader: () => Promise<ServerApiModule>;
  readonly methods?: string[];
};

export type ServerMatchedApiRoute = ServerLoadableApiRoute & RouteMatch;

export type ServerLoadedApiRoute = ServerMatchedApiRoute & {
  readonly module: ServerApiModule;
};

// ---------------------------------------------------------------------------------------
// Page Routes
// ---------------------------------------------------------------------------------------

export type ServerPageModule = {
  [id: string]: unknown;
  staticLoader?: StaticLoader;
  serverLoader?: ServerLoader;
};

export type ServerLoadablePageRoute = LoadableRoute<ServerPageModule>;

export type ServerMatchedPageRoute<Params extends RequestParams = RequestParams> = MatchedRoute<
  ServerPageModule,
  Params
>;

export type ServerLoadedPageRoute<Params extends RequestParams = RequestParams> = LoadedRoute<
  ServerPageModule,
  Params
>;

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link}
 */
export type ServerPageResource = {
  href: string;
  rel?: 'prefetch' | 'preload' | 'modulepreload' | 'stylesheet';
  as?: 'audio' | 'video' | 'image' | 'fetch' | 'font' | 'script' | 'style' | 'track' | 'worker';
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

export type ServerLoader<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
> = ServerRequestHandler<Params, Response>;

export type InferServerLoaderParams<T> = InferServerRequestHandlerParams<T>;
export type InferServerLoaderData<T> = InferServerRequestHandlerData<T>;

// ---------------------------------------------------------------------------------------
// Static Loader
// ---------------------------------------------------------------------------------------

export type StaticLoaderEvent<Params extends RequestParams = RequestParams> = Readonly<{
  pathname: string;
  route: Route;
  params: Params;
  serverFetch: ServerFetch;
}>;

/** Map of data asset id to server loaded data objects. */
export type StaticLoaderDataMap = Map<string, JSONData>;

/** Key can be anything but only truthy values are cached. */
export type StaticLoaderCacheKey = unknown;

export type StaticLoaderCacheMap = Map<StaticLoaderCacheKey, StaticLoaderResponse>;

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

export type InferStaticLoaderData<T> = T extends StaticLoader<never, infer Data> ? Data : T;
