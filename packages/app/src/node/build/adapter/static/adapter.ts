import kleur from 'kleur';
import {
  createStaticDataScriptTag,
  findPreviewScriptName,
  guessPackageManager,
  writeFiles,
} from 'node/build/build-utils';
import { logBadLinks, logRoutes } from 'node/build/log';
import { buildAllSitemaps } from 'node/build/sitemap';
import { logger, LoggerIcon } from 'node/utils';
import ora from 'ora';
import { createDocumentResourceLinkTags } from 'server';

import { type BuildAdapterFactory } from '../build-adapter';

export type StaticBuildAdapterConfig = {
  // no-ops
};

export function createStaticBuildAdapter(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: StaticBuildAdapterConfig = {},
): BuildAdapterFactory {
  return (app, bundles, build) => {
    logger.info(kleur.bold(`vessel@${app.version}`));

    const startTime = Date.now();
    const renderingSpinner = ora();

    const trailingSlashes = app.config.routes.trailingSlash;
    const trailingSlashTag = !trailingSlashes
      ? `<script>__VSL_TRAILING_SLASH__ = false;</script>`
      : '';

    return {
      name: 'static',
      startRenderingPages() {
        renderingSpinner.start(
          kleur.bold(
            `Rendering ${kleur.underline(
              build.staticPages.size,
            )} static pages...`,
          ),
        );
      },
      finishRenderingPages() {
        renderingSpinner.stopAndPersist({
          symbol: LoggerIcon.Success,
          text: kleur.bold(
            `Rendered ${kleur.underline(build.staticPages.size)} static pages`,
          ),
        });
      },

      async write() {
        // ---------------------------------------------------------------------------------------
        // REDIRECTS
        // ---------------------------------------------------------------------------------------

        const redirectFiles = new Map<string, string>();
        const redirectsTable: Record<string, string> = {};

        for (const redirect of build.staticRedirects.values()) {
          redirectFiles.set(redirect.filename, redirect.html);
          redirectsTable[redirect.from] = redirect.to;
        }

        let redirectsScriptTag = '';
        if (Object.keys(redirectsTable).length > 0) {
          // Embedded as a string and `JSON.parsed` from the client because it's faster than
          // embedding as a JS object literal.
          const serializedRedirectsTable = JSON.stringify(
            JSON.stringify(redirectsTable),
          );

          redirectsScriptTag = `<script>__VSL_STATIC_REDIRECTS_MAP__ = JSON.parse(${serializedRedirectsTable});</script>`;
        }

        // ---------------------------------------------------------------------------------------
        // Data
        // ---------------------------------------------------------------------------------------

        const dataTable: Record<string, string> = {};
        const dataFiles = new Map<string, string>();

        for (const data of build.staticData.values()) {
          dataFiles.set(data.filename, data.serializedData);
          dataTable[data.idHash] = data.contentHash;
        }

        let dataHashScriptTag = '';
        if (Object.keys(dataTable).length > 0) {
          // Embedded as a string and `JSON.parsed` from the client because it's faster than
          // embedding as a JS object literal.
          const serializedDataTable = JSON.stringify(JSON.stringify(dataTable));
          dataHashScriptTag = `<script>__VSL_STATIC_DATA_HASH_MAP__ = JSON.parse(${serializedDataTable});</script>`;
        }

        // ---------------------------------------------------------------------------------------
        // HTML Pages
        // ---------------------------------------------------------------------------------------

        const htmlFiles = new Map<string, string>();

        const buildingSpinner = ora();
        const htmlPagesCount = kleur.underline(build.staticRenders.size);

        buildingSpinner.start(
          kleur.bold(`Building ${htmlPagesCount} HTML pages...`),
        );

        const entrySrc = bundles.client.entry.chunk.fileName;
        const entryScriptTag = `<script type="module" src="/${entrySrc}" defer></script>`;

        for (const render of build.staticRenders.values()) {
          const linkTags = createDocumentResourceLinkTags(build.resources.all, [
            ...build.resources.entry,
            ...build.resources.app,
            ...build.resources.routes.get(render.route.id)!,
          ]);

          const headTags = [
            ...linkTags,
            render.ssr.css ?? '',
            render.ssr.head ?? '',
          ]
            .filter((t) => t.length > 0)
            .join('\n    ');

          const bodyTags = [
            redirectsScriptTag,
            dataHashScriptTag,
            createStaticDataScriptTag(render.dataAssetIds, build),
            trailingSlashTag,
            entryScriptTag,
          ]
            .filter((t) => t.length > 0)
            .join('\n    ');

          const pageHtml = build.template
            .replace(`<!--@vessel/head-->`, headTags)
            .replace('<!--@vessel/body-->', bodyTags)
            .replace(`<!--@vessel/app-->`, render.ssr.html);

          htmlFiles.set(render.filename, pageHtml);
        }

        buildingSpinner.stopAndPersist({
          text: kleur.bold(`Built ${htmlPagesCount} HTML pages`),
          symbol: LoggerIcon.Success,
        });

        // ---------------------------------------------------------------------------------------
        // SITEMAPS
        // ---------------------------------------------------------------------------------------

        if (app.config.sitemap.length > 0) {
          const sitemapsSpinner = ora();
          const sitemapCount = kleur.underline(app.config.sitemap.length);

          sitemapsSpinner.start(
            kleur.bold(`Building ${sitemapCount} sitemaps...`),
          );

          const sitemaps = await buildAllSitemaps(app, build);
          for (const [filename, content] of sitemaps) {
            htmlFiles.set(filename, content);
          }

          sitemapsSpinner.stopAndPersist({
            text: kleur.bold(`Built ${sitemapCount} sitemaps`),
            symbol: LoggerIcon.Success,
          });
        }

        // ---------------------------------------------------------------------------------------
        // WRITE
        // ---------------------------------------------------------------------------------------

        await writeFiles(
          htmlFiles,
          (filename) => app.dirs.client.resolve(filename),
          (count) => `Writing ${count} HTML files`,
          (count) => `Committed ${count} HTML files`,
        );

        await writeFiles(
          redirectFiles,
          (filename) => app.dirs.client.resolve(filename),
          (count) => `Writing ${count} HTML redirect files`,
          (count) => `Committed ${count} HTML redirect files`,
        );

        await writeFiles(
          dataFiles,
          (filename) => app.dirs.client.resolve(filename),
          (count) => `Writing ${count} data files`,
          (count) => `Committed ${count} data files`,
        );
      },
      async close() {
        logBadLinks(build.badLinks);
        logRoutes(app, build);

        const icons = {
          10: '🤯',
          20: '🏎️',
          30: '🏃',
          40: '🐌',
          Infinity: '⚰️',
        };

        const endTime = ((Date.now() - startTime) / 1000).toFixed(2);
        const formattedEndTime = kleur.underline(endTime);
        const icon = icons[Object.keys(icons).find((t) => endTime <= t)!];

        logger.success(
          kleur.bold(`Build complete in ${formattedEndTime} ${icon}`),
        );

        const pkgManager = await guessPackageManager(app);
        const previewCommand = await findPreviewScriptName(app);

        console.log(
          kleur.bold(
            `⚡ ${
              previewCommand
                ? `Run \`${
                    pkgManager === 'npm' ? 'npm run' : pkgManager
                  } ${previewCommand}\` to serve production build`
                : 'Ready for preview'
            }\n`,
          ),
        );
      },
    };
  };
}

export { createStaticBuildAdapter as default };
