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
  default: any;
  __markdownMeta?: MarkdownMeta;
};

export type ClientModuleLoader = () => Promise<ClientModule>;

// ---------------------------------------------------------------------------------------
// Client Route
// ---------------------------------------------------------------------------------------

export type ClientLoadableRoute = LoadableRoute<ClientModule>;

export type ClientMatchedRoute<Params extends RouteParams = RouteParams> =
  MatchedRoute<ClientModule, Params> & {
    error?: LoadedRoute['error'];
    loaded?: boolean;
  };

export type ClientLoadedRoute<Params extends RouteParams = RouteParams> =
  LoadedRoute<ClientModule, Params> & {
    loaded?: boolean;
  };

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

export type GoHrefOptions = {
  scroll?: ScrollToTarget | null;
  keepfocus?: boolean;
  replace?: boolean;
  state?: any;
};

export type NavigationOptions = GoHrefOptions & {
  blocked?: () => void;
  accepted?: () => void;
  canHandle?: () => void;
  redirects?: string[];
};

export type CancelNavigation = () => void;

export type NavigationRedirector = (
  pathnameOrURL: string | URL,
) => Promise<void>;

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
    u: [id: string, pathname: string, score: number];
    /** Whether this route contains a layout loader. */
    l?: 1;
    /** Whether this route contains an error boundary loader. */
    e?: 1;
    /** Whether this route contains a page loader. */
    p?: 1;
  }[];
};
