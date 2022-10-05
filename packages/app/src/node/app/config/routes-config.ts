import type { BuildBundles, BuildData } from 'node/build';

export type ResolvedRoutesConfig = {
  /**
   * An array of pages to crawl from. The given path must be a valid route such as
   * `/getting-started/` or `/getting-started/intro.html` and a page must match.
   */
  entries: string[];
  /**
   * Whether trailing slashes on URL paths should be kept or removed. The default behavior is to
   * remove it.
   *
   * @defaultValue false
   */
  trailingSlash: boolean;
  /**
   * Route matchers are used to inject pattern matching into file paths. For example, a file path
   * like `[int]/page.md` has a matcher named `int` which can then be defined at `routes.matchers`
   * in your Vessel config. The `[int]` will be replaced with the string or Regex you provide.
   * You can provide multiple placeholders for a single file name or path.
   *
   * @example
   * ```js
   * const config = {
   *   routes: {
   *     matchers: [{
   *       name: 'int',
   *       matcher: /\d+/,
   *     }],
   *   },
   * };
   * ```
   */
  matchers: RouteMatcherConfig;
  /**
   * The route logging style.
   *
   * @defaultValue `tree`
   */
  log: RoutesLogStyle;
  /**
   * Page routing configuration object.
   */
  pages: {
    /**
     * Globs indicating page files to be included in Vessel (relative to `<app>`).
     */
    include: string[];
    /**
     * Globs or RegExp indicating page files to be excluded from Vessel (relative to `<app>`).
     */
    exclude: (string | RegExp)[];
  };
  /**
   * Layouts routing configuration object.
   */
  layouts: {
    /**
     * Globs indicating layout files to be included in Vessel (relative to `<app>`).
     */
    include: string[];
    /**
     * Globs or RegExp indicating layout files to be excluded from Vessel (relative to `<app>`).
     */
    exclude: (string | RegExp)[];
  };
  /**
   * Error routing configuration object.
   */
  errors: {
    /**
     * Globs indicating error files to be included in Vessel (relative to `<app>`).
     */
    include: string[];
    /**
     * Globs or RegExp indicating error files to be excluded from Vessel (relative to `<app>`).
     */
    exclude: (string | RegExp)[];
  };
  http: {
    /**
     * Globs indicating serverless/edge functions to be included in Vessel (relative to `<app>`).
     */
    include: string[];
    /**
     * Globs or RegExp indicating serverless/edge functions to be excluded from Vessel (relative
     * to `<app>`).
     */
    exclude: (string | RegExp)[];
  };
};

export type RoutesLogStyle = 'none' | 'table' | CustomRoutesLogger;

export type CustomRoutesLogger = (
  input: RoutesLoggerInput,
) => void | Promise<void>;

export type RoutesLoggerInput = { build: BuildData; bundles: BuildBundles };

export type RouteMatcher = string | RegExp | null | undefined | void;

export type SimpleRouteMatcher = {
  name: string;
  matcher: RouteMatcher;
};

export type ComplexRouteMatcher = (
  route: string,
  info: { path: string },
) => string | null | undefined | void;

export type RouteMatcherConfig = (SimpleRouteMatcher | ComplexRouteMatcher)[];

export type RoutesConfig = Partial<
  Omit<ResolvedRoutesConfig, 'pages' | 'layouts' | 'errors' | 'http'>
> & {
  pages?: Partial<ResolvedRoutesConfig['pages']>;
  layouts?: Partial<ResolvedRoutesConfig['layouts']>;
  errors?: Partial<ResolvedRoutesConfig['errors']>;
  http?: Partial<ResolvedRoutesConfig['http']>;
};
