import type { MarkdownMeta } from 'shared/markdown';
import type { LoadableRoute, LoadedRoute, MatchedRoute, RouteParams } from 'shared/routing';

import type { ScrollToTarget } from './scroll-delegate';

// ---------------------------------------------------------------------------------------
// Client Module
// ---------------------------------------------------------------------------------------

export interface ClientModule {
  [id: string]: unknown;
  default: any;
  __markdownMeta?: MarkdownMeta;
}

export interface ClientModuleLoader {
  (): Promise<ClientModule>;
}

// ---------------------------------------------------------------------------------------
// Client Route
// ---------------------------------------------------------------------------------------

export interface ClientLoadableRoute extends LoadableRoute<ClientModule> {}

export interface ClientMatchedRoute<Params extends RouteParams = RouteParams>
  extends MatchedRoute<ClientModule, Params> {
  error?: LoadedRoute['error'];
}

export interface ClientLoadedRoute<Params extends RouteParams = RouteParams>
  extends LoadedRoute<ClientModule, Params> {}

export interface ClientRouteDeclaration extends Omit<ClientLoadableRoute, 'score' | 'pattern'> {
  score?: number;
}

// ---------------------------------------------------------------------------------------
// Client Navigation
// ---------------------------------------------------------------------------------------

export type Navigation = {
  from: URL | null;
  to: URL;
} | null;

export interface GoHrefOptions {
  scroll?: ScrollToTarget | null;
  keepfocus?: boolean;
  replace?: boolean;
  state?: any;
}

export interface NavigationOptions extends GoHrefOptions {
  blocked?: () => void;
  accepted?: () => void;
  canHandle?: () => void;
  redirects?: string[];
}

export interface CancelNavigation {
  (): void;
}

export interface NavigationRedirector {
  (pathnameOrURL: string | URL): Promise<void>;
}

export interface BeforeNavigateHook {
  (navigation: {
    from: ClientLoadedRoute | null;
    to: ClientMatchedRoute;
    cancel: CancelNavigation;
    redirect: NavigationRedirector;
  }): void | Promise<void>;
}

export interface AfterNavigateHook {
  (navigation: { from: ClientLoadedRoute | null; to: ClientLoadedRoute }): void | Promise<void>;
}

// ---------------------------------------------------------------------------------------
// Client Manifest
// ---------------------------------------------------------------------------------------

/**
 * ```ts
 * import manifest from ":virtual/vessel/manifest";
 * ```
 */
export interface ClientManifest {
  /** Page, layout, and error component module loaders - stored like this to save bytes. */
  loaders: ClientModuleLoader[];
  /** Contains loader indicies ^ who can fetch data from the server. */
  fetch: number[];
  /** Client routes that were discovered by the build process. */
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
}
