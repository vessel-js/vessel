import type { RouteFileType } from 'node/app/files';
import type { AppRoute } from 'node/app/routes';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import { ServerConfig } from 'server/http/app/configure-server';
import type {
  ServerDocumentResource,
  ServerDocumentResourceEntry,
  ServerLoadedDocumentRoute,
  ServerRenderResult,
} from 'server/types';
import type { RouteComponentType } from 'shared/routing';
import type { Manifest as ViteManifest } from 'vite';

export type BuildBundles = {
  entries: Record<string, string>;
  client: {
    bundle: OutputBundle;
    chunks: OutputChunk[];
    assets: OutputAsset[];
    manifest: ViteManifest;
    entry: { chunk: OutputChunk };
    app: {
      chunk: OutputChunk;
      css: OutputAsset[];
      assets: OutputAsset[];
    };
  };
  server: {
    bundle: OutputBundle;
    chunks: OutputChunk[];
    entry: { chunk: OutputChunk };
    app: { chunk: OutputChunk };
    configs: {
      shared?: OutputChunk;
      node?: OutputChunk;
      edge?: OutputChunk;
    };
    routes: {
      /** Route ids and their respective server component chunks.  */
      chunks: Map<string, { [P in RouteFileType]?: OutputChunk }>;
      /** Route ids and their respective server component chunk file paths (absolute). */
      files: Map<string, { [P in RouteFileType]?: string }>;
    };
  };
};

export type BuildData = {
  /**
   * Application entry files that are passed to Rollup's `input` option.
   */
  entries: Record<string, string>;
  /**
   * Rollup client and server bundle outputs.
   */
  bundles: BuildBundles;
  /**
   * The HTML template to be used for creating static pages.
   */
  template: string;
  /**
   * Valid links and their respective routes that were found during the static build process.
   */
  links: Map<string, AppRoute>;
  /**
   * Map of invalid links that were either malformed or matched no route pattern during
   * the static build process. The key contains the bad URL pathname.
   */
  badLinks: Map<string, { route?: AppRoute; reason: string }>;
  /**
   * All document resources and references (e.g., js, css, fonts, etc.). Mainly used to build
   * preload and prefetch directives to avoid waterfalls client-side.
   */
  resources: {
    all: ServerDocumentResource[];
    entry: ServerDocumentResourceEntry[];
    app: ServerDocumentResourceEntry[];
    routes: Record<string, ServerDocumentResourceEntry[]>;
  };
  static: {
    /**
     * Page routes that are static meaning they contain no `serverLoader` in their branch (page/error
     * itself or any of its layouts).
     */
    pages: Set<AppRoute>;
    /**
     * Redirects returned from `staticLoader` calls. The object keys are the URL pathname being
     * redirected from.
     */
    redirects: Map<
      string,
      {
        /** The URL pathname being redirected from. */
        from: string;
        /** The URL pathname being redirected to. */
        to: string;
        /** The redirect HTML file name which can be used to output file relative to build directory. */
        filename: string;
        /** The HTML file content containing the redirect meta tag. */
        html: string;
        /** HTTP status code used for the redirect. */
        status: number;
      }
    >;
    /**
     * Map of links (URL pathname) and their respective SSR rendered content and loaded data asset
     * IDs.
     */
    renders: Map<
      string,
      {
        /** The HTML file name which can be used to output file relative to build directory. */
        filename: string;
        /** The matching page route. */
        route: AppRoute;
        /** The loaded server routes. */
        matches: ServerLoadedDocumentRoute[];
        /** The SSR results containing head, css, and HTML renders. */
        ssr: ServerRenderResult;
        /**
         * All static data asset ID's that belong to this path. These can be used find matching
         * records in the `staticData` object.
         */
        data: Set<string>;
      }
    >;
    /**
     * Static JSON data that has been loaded by pages and layouts. The key is a unique data asset ID
     * for the given route and URL path combination.
     */
    data: Map<
      string,
      {
        /** The data JSON file name which can be used to output file relative to build directory. */
        filename: string;
        /** Loaded data. */
        data: Record<string, unknown>;
        /** The loaded data serailized (JSON.stringify). */
        serializedData: string;
        /** The data asset ID sha-1 hash. */
        idHash: string;
        /** The serialized content sha-1 hash. */
        contentHash: string;
      }
    >;
    /**
     * Map of route ids and their respective plain data asset ids. This includes _all_ data asset
     * ids across all URL paths.
     */
    routeData: Map<string, Set<string>>;
    /**
     * Record of hashed data asset ids and their respective hashed content id.
     */
    clientHashRecord: Record<string, string>;
    /**
     * Record of plain data asset ids and their respective hashed id.
     */
    serverHashRecord: Record<string, string>;
  };
  server: {
    /**
     * Routes that are dynamic meaning they contain a `serverLoader` in their branch (page/error
     * itself or any of its layouts).
     */
    routes: Set<AppRoute>;
    /**
     * Route ids and whether their respective component modules contain a `serverLoader` export. If
     * a route id exists in this map it means that one if its components in its branch has a
     * `serverLoader` - it might not contain any itself.
     */
    loaders: Map<string, { [P in RouteComponentType]?: boolean }>;
    /**
     * Raw HTTP server endpoints.
     */
    endpoints: Set<AppRoute>;
    /**
     * Loaded server configuration files.
     */
    configs: {
      shared?: ServerConfig;
      edge?: ServerConfig;
      node?: ServerConfig;
    };
  };
  edge: {
    /**
     * Page and HTTP route ids that should be dynamically rendered at the edge
     *
     * ```ts
     * // Edge routes contain the following export in their branch:
     * export const EDGE = true;
     * ```
     */
    routes: Set<string>;
  };
};
