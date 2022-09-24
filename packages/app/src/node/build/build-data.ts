import type { RouteFileType } from 'node/app/files';
import type { AppRoute } from 'node/app/routes';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import type {
  DocumentResource,
  DocumentResourceEntry,
  ServerLoadedRoute,
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
  };
};

export type BuildData = {
  /**
   * Application entry files that are passed to Rollup's `input` option.
   */
  entries: Record<string, string>;
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
    all: DocumentResource[];
    entry: DocumentResourceEntry[];
    app: DocumentResourceEntry[];
    routes: Map<string, DocumentResourceEntry[]>;
  };
  /**
   * Page routes that are static meaning they contain no `serverLoader` in their branch (page
   * itself or any of its layouts).
   */
  staticPages: Set<AppRoute>;
  /**
   * Redirects returned from `staticLoader` calls. The object keys are the URL pathname being
   * redirected from.
   */
  staticRedirects: Map<
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
  staticRenders: Map<
    string,
    {
      /** The HTML file name which can be used to output file relative to build directory. */
      filename: string;
      /** The matching page route. */
      route: AppRoute;
      /** The loaded server routes. */
      matches: ServerLoadedRoute[];
      /** The SSR results containing head, css, and HTML renders. */
      ssr: ServerRenderResult;
      /**
       * All static data asset ID's that belong to this path. These can be used find matching
       * records in the `staticData` object.
       */
      dataAssetIds: Set<string>;
    }
  >;
  /**
   * Static JSON data that has been loaded by pages and layouts. The key is a unique data asset ID
   * for the given route and URL path combination. You can find data ID's in the `renders` map
   * for each page.
   */
  staticData: Map<
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
   * Route ids and their respective component chunks.
   */
  routeChunks: Map<string, { [P in RouteFileType]?: OutputChunk }>;
  /**
   * Route ids and their respective component chunk file paths (absolute).
   */
  routeChunkFile: Map<string, { [P in RouteFileType]?: string }>;
  /**
   * File routes that _do not_ contain a `serverLoader` in their branch.
   */
  staticRoutes: Set<AppRoute>;
  /**
   * File routes that contain a `serverLoader` export in their branch. These routes should be
   * dynamically rendered on the server.
   */
  serverRoutes: Set<AppRoute>;
  /**
   * Route ids and whether their respective component modules contain a `serverLoader`.
   */
  serverLoadable: Map<string, { [P in RouteComponentType]?: boolean }>;
  /**
   * Page routes that are dynamic meaning they contain a `serverLoader` in their branch (page
   * itself or any of its layouts). These pages are dynamically rendered on the server.
   */
  serverPages: Set<AppRoute>;
  /**
   * Server endpoints that are used server-side to respond to HTTP requests.
   */
  serverEndpoints: Set<AppRoute>;
};
