import type { MarkdownMeta } from 'shared/markdown';
import type {
  LoadableRoute,
  LoadedRoute,
  MatchedRoute,
  RouteParams,
} from 'shared/routing';

import type { ScrollToTarget } from './scroll-delegate';

// ---------------------------------------------------------------------------------------
// Client Module
// ---------------------------------------------------------------------------------------

export type ClientModule = {
  [id: string]: unknown;
  __markdownMeta?: MarkdownMeta;
};

export type ClientModuleLoader = () => Promise<ClientModule>;

// ---------------------------------------------------------------------------------------
// Client Route
// ---------------------------------------------------------------------------------------

export type ClientLoadableRoute = LoadableRoute<ClientModule>;

export type ClientMatchedRoute<Params extends RouteParams = RouteParams> =
  MatchedRoute<ClientModule, Params>;

export type ClientLoadedRoute<Params extends RouteParams = RouteParams> =
  LoadedRoute<ClientModule, Params>;

export type ClientRouteDeclaration = Omit<
  ClientLoadableRoute,
  'score' | 'pattern'
> & { score?: number };

// ---------------------------------------------------------------------------------------
// Client Navigation
// ---------------------------------------------------------------------------------------

export type Navigation = {
  from: URL | null;
  to: URL;
} | null;

export type RouterGoOptions = {
  scroll?: ScrollToTarget | null;
  keepfocus?: boolean;
  replace?: boolean;
  state?: any;
};

export type NavigationOptions = RouterGoOptions & {
  accepted?: () => void;
  blocked?: () => void;
  redirects?: string[];
};

export type CancelNavigation = () => void;

export type NavigationRedirector = (pathnameOrURL: string | URL) => void;

export type BeforeNavigateHook = (navigation: {
  from: ClientLoadedRoute | null;
  to: ClientMatchedRoute;
  cancel: CancelNavigation;
  redirect: NavigationRedirector;
}) => void | Promise<void>;

export type AfterNavigateHook = (navigation: {
  from: ClientLoadedRoute | null;
  to: ClientLoadedRoute;
}) => void | Promise<void>;

// ---------------------------------------------------------------------------------------
// Client Manifest
// ---------------------------------------------------------------------------------------

/**
 * ```ts
 * import manifest from ":virtual/vessel/manifest";
 * ```
 */
export type ClientManifest = {
  /** Page, layout, and error component module loaders - stored like this to save bytes. */
  loaders: ClientModuleLoader[];
  /** Contains loader indicies ^ who can fetch data from the server. */
  fetch: number[];
  routes: {
    /** URL pathname used to construct `URLPattern` and it's route score. */
    path: [id: string, pathname: string, score: number];
    /** Whether this route contains a layout loader. */
    layout?: 1;
    /** Whether this route contains an error loader. */
    error?: 1;
    /** Whether this route contains a page loader. */
    page?: 1;
  }[];
};
