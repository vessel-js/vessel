import esbuild from 'esbuild';
import kleur from 'kleur';
import { createDirectory } from 'node/app/create/app-dirs';
import { copyDir, LoggerIcon, mkdirp, requireShim, rimraf } from 'node/utils';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';
import { HTTP_METHODS } from 'server/http';
import { endslash, isLinkExternal, noendslash, slash } from 'shared/utils/url';

import { type BuildAdapterFactory } from '../build-adapter';
import { createStaticBuildAdapter } from '../static/adapter';
import { trailingSlash } from './trailing-slash';

const outputRoot = '.vercel/output';

const defaultFunctionsConfig = {
  runtime: 'nodejs16.x',
  handler: 'index.js',
  maxDuration: 3,
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
  shouldAddSourcemapSupport: true,
};

const defaultEdgeConfig = {
  runtime: 'edge',
  entrypoint: 'index.js',
};

const matchersRE = /\[?\[(?:.*?)\]\]?/g;

export function createVercelBuildAdapter(
  config?: VercelBuildAdapterConfig,
): BuildAdapterFactory {
  return async (app, bundles, build) => {
    const vercelDirs = {
      root: createDirectory(app.dirs.root.resolve(outputRoot)),
      static: createDirectory(app.dirs.root.resolve(`${outputRoot}/static`)),
      fns: createDirectory(app.dirs.root.resolve(`${outputRoot}/functions`)),
    };

    const trailingSlashes = app.config.routes.trailingSlash;
    const staticAdapter = await createStaticBuildAdapter()(app, bundles, build);

    return {
      ...staticAdapter,
      name: 'vercel',
      async write() {
        console.log(kleur.magenta('\n+ vercel\n'));

        rimraf(vercelDirs.root.path);
        mkdirp(vercelDirs.root.path);

        await staticAdapter.write?.();

        copyDir(app.dirs.client.path, vercelDirs.static.path);

        const redirects = Array.from(build.static.redirects.values()).map(
          (redirect) => ({
            src: redirect.from.replace(/\/$/, '/?'),
            headers: {
              Location: isLinkExternal(redirect.to, app.vite.resolved!.base)
                ? redirect.to
                : trailingSlashes
                ? endslash(redirect.to)
                : noendslash(redirect.to),
            },
            status: redirect.status,
          }),
        );

        const overrides: Record<string, { path: string }> = {};
        for (const page of build.static.renders.values()) {
          overrides[page.filename] = {
            path: noendslash(page.filename.replace('index.html', '')),
          };
        }

        const routes: {
          src?: string;
          dest?: string;
          headers?: Record<string, string>;
          status?: number;
          handle?: string;
        }[] = [
          ...(trailingSlashes ? trailingSlash.keep : trailingSlash.remove),
          ...redirects,
          {
            src: '/_immutable/.+',
            headers: { 'Cache-Control': 'public, immutable, max-age=31536000' },
          },
          { handle: 'filesystem' },
        ];

        const bundlingFunctionsSpinner = ora();
        const fnCount = kleur.underline(build.server.endpoints.size);
        bundlingFunctionsSpinner.start(
          kleur.bold(`Bundling ${fnCount} functions...`),
        );

        for (const route of build.server.endpoints) {
          const routeDir = route.http!.dir.route;
          routes.push({
            src: `^${slash(routeDir.replace(matchersRE, '([^/]+?)'))}/?$`, // ^/api/foo/?$
            dest: slash(routeDir), // /api/foo
          });
        }

        await Promise.all(
          Array.from(build.server.endpoints).map(async (route) => {
            const chunk = build.server.chunks.get(route.id)!.http;

            const allowedMethods = chunk?.exports.filter((id) =>
              HTTP_METHODS.has(id),
            );

            if (!chunk || allowedMethods!.length === 0) return;

            const isEdge =
              !!config?.edge?.all || chunk.exports.includes('EDGE');

            const resolveCode = isEdge ? resolveEdgeCode : resolveFunctionCode;

            const code = resolveCode(
              route.pattern.pathname,
              './+http.js',
              allowedMethods!,
            );

            const vcConfig = isEdge
              ? {
                  ...defaultEdgeConfig,
                  envVarsInUse: config?.edge?.envVarsInUse,
                }
              : {
                  ...defaultFunctionsConfig,
                  ...config?.functions,
                };

            const fndir = `${route.dir.route}.func`;
            const outdir = vercelDirs.fns.resolve(fndir);
            const chunkDir = path.posix.dirname(
              build.server.chunkFiles.get(route.id)!.http!,
            );
            const entryPath = path.posix.resolve(chunkDir, 'fn.js');

            await writeFile(entryPath, code);

            // eslint-disable-next-line import/no-named-as-default-member
            await esbuild.build({
              entryPoints: { index: entryPath },
              outdir,
              target: 'es2020',
              assetNames: 'assets/[name]-[hash]',
              chunkNames: 'chunks/[name]-[hash]',
              banner: !isEdge ? { js: requireShim } : undefined,
              bundle: true,
              splitting: true,
              minify: !app.config.debug,
              treeShaking: true,
              platform: 'node',
              format: 'esm',
              sourcemap: app.config.debug && 'external',
            });

            await writeFile(
              path.posix.resolve(outdir, 'package.json'),
              JSON.stringify({ type: 'module' }),
            );

            await writeFile(
              path.posix.resolve(outdir, '.vc-config.json'),
              JSON.stringify(vcConfig, null, 2),
            );
          }),
        );

        bundlingFunctionsSpinner.stopAndPersist({
          text: kleur.bold(`Committed ${fnCount} functions`),
          symbol: LoggerIcon.Success,
        });

        // SPA fallback so we can render 404 page.
        routes.push({
          src: '/(.*)',
          dest: '/index.html',
        });

        await writeFile(
          vercelDirs.root.resolve('config.json'),
          JSON.stringify({ version: 3, routes, overrides }, null, 2),
        );
      },
    };
  };
}

function resolveFunctionCode(
  pattern: string,
  moduleId: string,
  methods: string[],
) {
  return [
    "import { createEndpointHandler } from '@vessel-js/app/vercel/fn.js';",
    '',
    'export default createEndpointHandler(',
    `  () => new URLPattern({ pathname: '${pattern}' }),`,
    `  () => import('${moduleId}'),`,
    '  {',
    `    methods: [${methods.map((method) => `'${method}'`).join(', ')}],`,
    '  }',
    ');',
    '',
  ].join('\n');
}

function resolveEdgeCode(pattern: string, moduleId: string, methods: string[]) {
  return [
    "import { createEndpointHandler } from '@vessel-js/app/vercel/edge.js';",
    '',
    'export default createEndpointHandler (',
    `  new URLPattern({ pathname: '${pattern}' }),`,
    `  () => import('${moduleId}'),`,
    '  {',
    `    methods: [${methods.map((method) => `'${method}'`).join(', ')}],`,
    '  }',
    ');',
    '',
  ].join('\n');
}

export { createVercelBuildAdapter as default };

export type VercelBuildAdapterConfig = {
  /**
   * Whether trailing slashes should be kept or removed. The default behavior is to remove
   * it (e.g., `foo.com/bar/` becomes `foo.com/bar`).
   *
   * @defaultValue false
   */
  trailingSlash?: boolean;
  /**
   * @see {@link https://vercel.com/docs/build-output-api/v3#vercel-primitives/serverless-functions}
   */
  functions?: {
    /**
     * Specifies which "runtime" will be used to execute the Serverless Function.
     *
     * @defaultValue 'nodejs16.x'
     */
    runtime?: string;
    /**
     * Amount of memory (RAM in MB) that will be allocated to the Serverless Function.
     */
    memory?: number;
    /**
     * Maximum execution duration (in seconds) that will be allowed for the Serverless Function.
     *
     * @defaultValue 3
     */
    maxDuration?: number;
    /**
     * Map of additional environment variables that will be available to the Serverless Function,
     * in addition to the env vars specified in the Project Settings.
     */
    environment?: Record<string, string>[];
    /**
     * List of query string parameter names that will be cached independently. If an empty array,
     * query values are not considered for caching. If undefined each unique query value is cached
     * independently.
     */
    allowQuery?: string[];
    /**
     * List of Vercel Regions where the Serverless Function will be deployed to.
     *
     * @see {@link https://vercel.com/docs/concepts/functions/serverless-functions/regions}
     */
    regions?: string[];
  };
  /**
   * @see {@link https://vercel.com/docs/build-output-api/v3#vercel-primitives/edge-functions/configuration}
   */
  edge?: {
    /**
     * Whether all API endpoints should be output as edge functions.
     *
     * @defaultValue false
     */
    all?: boolean;
    /**
     * List of environment variable names that will be available for the Edge Function to utilize.
     *
     * @defaultValue []
     */
    envVarsInUse?: string[];
  };
};
