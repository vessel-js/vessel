import esbuild from 'esbuild';
import kleur from 'kleur';
import type { App, Directory } from 'node/app/App';
import { createDirectory } from 'node/app/create/app-dirs';
import { copyDir, LoggerIcon, mkdirp, rimraf } from 'node/utils';
import fs from 'node:fs';
import { writeFile } from 'node:fs/promises';
import ora from 'ora';
import * as path from 'pathe';
import { endslash, isLinkExternal, noendslash } from 'shared/utils/url';

import { type BuildAdapterFactory } from '../build-adapter';
import { createStaticBuildAdapter } from '../static/adapter';
import { noopStaticLoader } from '../utils';
import { trailingSlash } from './trailing-slash';

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

export function createVercelBuildAdapter(config?: VercelBuildAdapterConfig): BuildAdapterFactory {
  return async (app, build) => {
    const vercelDirs = {
      root: createDirectory(app.dirs.root.resolve('.vercel')),
      output: createDirectory(app.dirs.root.resolve('.vercel/output')),
      static: createDirectory(app.dirs.root.resolve(`.vercel/output/static`)),
    };

    const trailingSlashes = app.config.routes.trailingSlash;

    const staticAdapter = await createStaticBuildAdapter({ output: false })(app, build);

    return {
      name: 'vercel',
      async write() {
        rimraf(vercelDirs.output.path);
        mkdirp(vercelDirs.output.path);

        await staticAdapter.write?.();

        const serverRoutes = app.routes
          .toArray()
          .filter((route) => route.api || build.server.loaders.has(route.id));

        const edgeRoutes = build.edge.routes;

        const hasEdgeRoutes = edgeRoutes.size || build.server.configs.edge?.apiRoutes.length;

        const hasNodeRoutes =
          build.server.loaders.size || build.server.configs.node?.apiRoutes.length;

        if (!serverRoutes.length && !hasEdgeRoutes && !hasNodeRoutes) {
          return;
        }

        console.log(kleur.magenta('\n+ vercel\n'));

        copyDir(app.dirs.vessel.client.path, vercelDirs.static.path);

        const redirects = Array.from(build.static.redirects.values()).map((redirect) => ({
          src: redirect.from.replace(/\/$/, '/?'),
          headers: {
            Location: isLinkExternal(redirect.to, app.vite.resolved!.base)
              ? redirect.to
              : redirect.to === '/'
              ? '/'
              : trailingSlashes
              ? endslash(redirect.to)
              : noendslash(redirect.to),
          },
          status: redirect.status,
        }));

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
          methods?: string[];
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

        for (const route of serverRoutes) {
          routes.push({
            src: `^/${buildSrc(route.cleanId.slice(1))}/?`,
            dest: edgeRoutes.has(route.id) ? '/edge' : '/node',
          });
        }

        if (build.server.configs.edge) {
          const prefix = build.server.configs.edge.basePrefix;
          if (prefix.length > 0) {
            routes.push({ src: `${prefix}/(.*?)`, dest: '/edge' });
          }
        }

        if (build.server.configs.node) {
          const prefix = build.server.configs.node.basePrefix;
          if (prefix.length > 0) {
            routes.push({ src: `${prefix}/(.*?)`, dest: '/node' });
          }
        }

        const rootRoute = app.routes.toArray().find((route) => route.id === '/');

        // SPA fallback so we can render 404 page.
        if (rootRoute) {
          routes.push({
            src: '/(.*)',
            dest: build.server.loaders.size > 0 ? '/node' : '/index.html',
          });
        }

        if (hasEdgeRoutes) {
          await bundleEdge(app, vercelDirs.output, config?.edge);
        }

        if (hasNodeRoutes) {
          await bundleNode(app, vercelDirs.output, config?.functions);
        }

        await writeFile(
          vercelDirs.output.resolve('config.json'),
          JSON.stringify({ version: 3, routes, overrides }, null, 2),
        );
      },
    };
  };
}

const optionalRestMatcherRE = /\[\[\.\.\.(?:.*?)\]\]/g;
const restMatcherRE = /\[\.\.\.(?:.*?)\]/g;
const matcherRE = /\[(?:.*?)\]/g;

function buildSrc(path: string) {
  return path
    .replace(optionalRestMatcherRE, '(.+)')
    .replace(restMatcherRE, '(.*?)')
    .replace(matcherRE, '([^/]+?)');
}

async function bundleEdge(
  app: App,
  outputDir: Directory,
  config?: VercelBuildAdapterConfig['edge'],
) {
  const spinner = ora();
  spinner.start(kleur.bold(`Bundling edge functions...`));

  app.dirs.vessel.server.write(
    '.manifests/vercel.edge.js',
    [
      'import manifest from "./edge.js";',
      'import { createServer } from "@vessel-js/app/server";',
      'export default createServer(manifest);',
    ].join('\n'),
  );

  const outdir = outputDir.resolve('functions/edge.func');

  // eslint-disable-next-line import/no-named-as-default-member
  await esbuild.build({
    entryPoints: {
      index: app.dirs.vessel.server.resolve('.manifests/vercel.edge.js'),
    },
    outdir,
    logLevel: 'error',
    target: 'es2020',
    assetNames: 'assets/[name]-[hash]',
    chunkNames: 'chunks/[name]-[hash]',
    bundle: true,
    splitting: true,
    minify: !app.config.debug,
    treeShaking: true,
    platform: 'node',
    format: 'esm',
    sourcemap: app.config.debug && 'external',
    plugins: [noopStaticLoader()],
  });

  await writeFile(path.resolve(outdir, 'package.json'), JSON.stringify({ type: 'module' }));

  await writeFile(
    path.resolve(outdir, '.vc-config.json'),
    JSON.stringify({ ...defaultEdgeConfig, ...config }, null, 2),
  );

  spinner.stopAndPersist({
    text: kleur.bold(`Bundled edge functions`),
    symbol: LoggerIcon.Success,
  });
}

async function bundleNode(
  app: App,
  outputDir: Directory,
  config?: VercelBuildAdapterConfig['functions'],
) {
  const spinner = ora();
  spinner.start(kleur.bold(`Bundling node functions...`));

  app.dirs.vessel.server.write(
    '.manifests/vercel.node.js',
    [
      'import manifest from "./node.js";',
      'import { createIncomingMessageHandler } from "@vessel-js/app/node/http.js";',
      'export default createIncomingMessageHandler(manifest);',
    ].join('\n'),
  );

  const entry = app.dirs.vessel.server.resolve('.manifests/vercel.node.js');
  const outdir = outputDir.resolve('functions/node.func');

  // eslint-disable-next-line import/no-named-as-default-member
  await esbuild.build({
    entryPoints: { index: entry },
    outdir,
    target: 'es2020',
    logLevel: 'error',
    legalComments: 'none',
    assetNames: 'assets/[name]-[hash]',
    chunkNames: 'chunks/[name]-[hash]',
    bundle: true,
    splitting: true,
    treeShaking: true,
    platform: 'node',
    format: 'esm',
    sourcemap: app.config.debug && 'external',
    banner: {
      js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
    },
    plugins: [noopStaticLoader()],
  });

  fs.writeFileSync(
    `${outdir}/.vc-config.json`,
    JSON.stringify({ ...defaultFunctionsConfig, ...config }),
  );

  fs.writeFileSync(`${outdir}/package.json`, JSON.stringify({ type: 'module' }));

  spinner.stopAndPersist({
    text: kleur.bold(`Bundled node functions`),
    symbol: LoggerIcon.Success,
  });
}

export { createVercelBuildAdapter as default };

export type VercelBuildAdapterConfig = {
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
     * List of environment variable names that will be available for the Edge Function to utilize.
     *
     * @defaultValue []
     */
    envVarsInUse?: string[];
  };
};
