import type {
  JSONData,
  JSONResponse,
  RequestParams,
  VesselRequest,
  VesselRequestMetadata,
  VesselResponseMetadata,
} from 'shared/http';
import type {
  LoadableRoute,
  LoadedRoute,
  MatchedRoute,
  Route,
  RouteMatch,
} from 'shared/routing';

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
    /** Used client-side to fetch. Hashed data asset id to hashed content id. */
    clientHashRecord: Record<string, string>;
    /** Used server-side to serialize data. Plain data asset id to hashed client id. */
    serverHashRecord: Record<string, string>;
    /** Hashed client data asset id to dynamic data loader. */
    loaders: Record<string, () => Promise<{ data: JSONData } | undefined>>;
  };
  hooks?: {
    onDocumentRenderError?: (url: URL, error: unknown) => void;
    onUnexpectedHttpError?: (url: URL, error: unknown) => void;
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
  [id: string]: ServerRequestHandler;
};

export type ServerLoadableHttpRoute = Route & {
  readonly loader: () => Promise<ServerHttpModule>;
  readonly methods: string[];
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
// Server Request Event
// ---------------------------------------------------------------------------------------

export type ServerRequestEventInit<Params extends RequestParams> = {
  url: URL;
  params: Params;
  request: Request & Partial<VesselRequestMetadata>;
  response?: Partial<VesselResponseMetadata>;
  manifest?: ServerManifest;
};

export type ServerRequestEvent<Params extends RequestParams = RequestParams> = {
  params: Params;
  request: VesselRequest;
  response: VesselResponseMetadata;
  fetcher: ServerFetcher;
};

// ---------------------------------------------------------------------------------------
// Server Request Handler
// ---------------------------------------------------------------------------------------

export type ServerRequestHandler<
  Params extends RequestParams = RequestParams,
  Output extends ServerRequestHandlerOutput = Response,
> = (event: ServerRequestEvent<Params>) => Output | Promise<Output>;

export type ServerRequestHandlerOutput<Data extends JSONData = JSONData> =
  | string
  | Data
  | Response
  | JSONResponse<Data>;

export type InferServerRequestHandlerData<
  Output extends ServerRequestHandlerOutput,
> = Output extends Response
  ? Output extends JSONResponse<infer Data>
    ? Data
    : unknown
  : Output;

// ---------------------------------------------------------------------------------------
// Static Loader
// ---------------------------------------------------------------------------------------

export type StaticLoaderEvent<Params extends RequestParams = RequestParams> =
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
  event: StaticLoaderEvent,
) => StaticLoaderCacheKey | Promise<StaticLoaderCacheKey>;

export type StaticLoader<
  Params extends RequestParams = RequestParams,
  Data extends JSONData = JSONData,
> = (
  event: StaticLoaderEvent<Params>,
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

export type ServerLoader<
  Params extends RequestParams = RequestParams,
  Output extends ServerLoaderOutput = Response,
> = (event: ServerRequestEvent<Params>) => Output | Promise<Output>;

export type ServerLoaderOutput<Data extends JSONData = JSONData> =
  ServerRequestHandlerOutput<Data>;

// ---------------------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------------------

export type ServerAction<
  Params extends RequestParams = RequestParams,
  Output extends ServerLoaderOutput = ServerLoaderOutput,
> = (event: ServerRequestEvent<Params>) => Output | Promise<Output>;
