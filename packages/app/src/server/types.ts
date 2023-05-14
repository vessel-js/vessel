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

export interface ServerEntryContext {
  router: any;
  route: ServerLoadedPageRoute;
  matches: ServerLoadedPageRoute[];
}

export interface ServerEntryModule {
  [id: string]: unknown;
  render: ServerRenderer;
}

export interface ServerEntryLoader {
  (): Promise<ServerEntryModule>;
}

export interface ServerRenderer {
  (context: ServerEntryContext): Promise<ServerRenderResult>;
}

export interface ServerRenderResult {
  head?: string;
  css?: string;
  html: string;
  body?: string;
  bodyAttrs?: string;
  htmlAttrs?: string;
}

export interface ServerFetch<RPC extends RPCHandler = RPCHandler> {
  (input: RequestInfo | URL | RPC, init?: ServerFetchInit<InferServerFetchParams<RPC>>): Promise<
    InferServerFetchResponse<RPC>
  >;
}

export interface ServerFetchInit<Params extends RequestParams = RequestParams>
  extends ClientFetchInit<Params> {}

export type InferServerFetchParams<RPC extends RPCHandler> = InferServerRequestHandlerParams<RPC>;

export type InferServerFetchResponse<RPC extends RPCHandler> = RPC extends ServerRequestHandler<
  any,
  infer Response
>
  ? Response extends JSONResponse<infer Data>
    ? VesselJSONResponse<Data>
    : VesselResponse
  : VesselResponse;

export interface ServerRedirect {
  readonly path: string;
  readonly status: number;
}

// ---------------------------------------------------------------------------------------
// Server Manifest
// ---------------------------------------------------------------------------------------

export interface ServerManifest {
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
}

export interface ServerErrorRoute extends Route {
  readonly handler: ServerErrorHandler;
}

export interface ServerErrorHandler {
  (request: VesselRequest, error: unknown): void | AnyResponse | Promise<void | AnyResponse>;
}

export interface ServerMiddlewareEntry {
  readonly group?: string;
  readonly handler: FetchMiddleware;
}

// ---------------------------------------------------------------------------------------
// Request Event
// ---------------------------------------------------------------------------------------

export interface ServerRequestEvent<Params extends RequestParams = RequestParams> {
  request: VesselRequest;
  params: Params;
  response: ResponseDetails;
  page?: ResponseDetails;
  serverFetch: ServerFetch;
}

export interface ServerRequestEventInit<Params extends RequestParams = RequestParams> {
  request: VesselRequest;
  params: Params;
  page?: ResponseDetails;
  manifest: ServerManifest;
}

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

export interface ServerApiModule {
  [id: string]: ServerRequestHandler;
}

export interface ServerLoadableApiRoute extends Route {
  readonly loader: () => Promise<ServerApiModule>;
  readonly methods?: string[];
}

export interface ServerMatchedApiRoute extends ServerLoadableApiRoute, RouteMatch {}

export interface ServerLoadedApiRoute extends ServerMatchedApiRoute {
  readonly module: ServerApiModule;
}

// ---------------------------------------------------------------------------------------
// Page Routes
// ---------------------------------------------------------------------------------------

export interface ServerPageModule {
  [id: string]: unknown;
  staticLoader?: StaticLoader;
  serverLoader?: ServerLoader;
}

export interface ServerLoadablePageRoute extends LoadableRoute<ServerPageModule> {}

export interface ServerMatchedPageRoute<Params extends RequestParams = RequestParams>
  extends MatchedRoute<ServerPageModule, Params> {}

export interface ServerLoadedPageRoute<Params extends RequestParams = RequestParams>
  extends LoadedRoute<ServerPageModule, Params> {}

/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link}
 */
export interface ServerPageResource {
  href: string;
  rel?: 'prefetch' | 'preload' | 'modulepreload' | 'stylesheet';
  as?: 'audio' | 'video' | 'image' | 'fetch' | 'font' | 'script' | 'style' | 'track' | 'worker';
  type?: string;
  crossorigin?: boolean;
}

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
> extends ServerRequestHandler<Params, Response> {}

export type InferServerLoaderParams<T> = InferServerRequestHandlerParams<T>;

export type InferServerLoaderData<T> = InferServerRequestHandlerData<T>;

// ---------------------------------------------------------------------------------------
// Static Loader
// ---------------------------------------------------------------------------------------

export interface StaticLoaderEvent<Params extends RequestParams = RequestParams>
  extends Readonly<{
    url: URL;
    pathname: string;
    route: Route;
    params: Params;
    serverFetch: ServerFetch;
  }> {}

/** Map of data asset id to server loaded data objects. */
export interface StaticLoaderDataMap extends Map<string, JSONData> {}

/** Key can be anything but only truthy values are cached. */
export type StaticLoaderCacheKey = unknown;

export interface StaticLoaderCacheMap extends Map<StaticLoaderCacheKey, StaticLoaderResponse> {}

export interface StaticLoaderCacheKeyBuilder {
  (event: StaticLoaderEvent): StaticLoaderCacheKey | Promise<StaticLoaderCacheKey>;
}

export interface StaticLoader<
  Params extends RequestParams = RequestParams,
  Data extends JSONData = JSONData,
> {
  (event: StaticLoaderEvent<Params>):
    | MaybeStaticLoaderResponse<Data>
    | Promise<MaybeStaticLoaderResponse<Data>>;
}

export type MaybeStaticLoaderResponse<Data = JSONData> =
  | void
  | undefined
  | null
  | StaticLoaderResponse<Data>;

export interface StaticLoaderResponse<Data = JSONData> {
  data?: Data;
  readonly redirect?: string | { path: string; status?: number };
  readonly cache?: StaticLoaderCacheKeyBuilder;
}

export type InferStaticLoaderParams<T> = T extends StaticLoader<infer Params>
  ? Params
  : RequestParams;

export type InferStaticLoaderData<T> = T extends StaticLoader<never, infer Data> ? Data : T;
