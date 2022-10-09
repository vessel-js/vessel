import kleur from 'kleur';
import type {
  DocumentResource,
  DocumentResourceEntry,
  ServerLoadedRoute,
  ServerManifest,
  ServerMatchedRoute,
} from 'server/types';
import { resolveStaticDataAssetId } from 'shared/data';
import {
  type AnyResponse,
  coerceAnyResponse,
  Cookies,
  createVesselRequest,
  createVesselResponse,
  HttpError,
  isClientRedirectResponse,
  isHttpError,
  isRedirectResponse,
  isResponse,
  isVesselResponse,
  resolveResponseData,
  type VesselResponse,
  withMiddleware,
} from 'shared/http';
import {
  getRouteComponentDataKeys,
  getRouteComponentTypes,
  type LoadedRouteComponent,
  type LoadedServerData,
  loadRoutes,
  matchAllRoutes,
  resolveSettledPromiseRejection,
  resolveSettledPromiseValue,
  type RouteComponentType,
  stripRouteComponentTypes,
} from 'shared/routing';
import type { Mutable } from 'shared/types';
import { coerceError } from 'shared/utils/error';
import { slash } from 'shared/utils/url';

import {
  createStaticDataScriptTag,
  createStaticLoaderDataMap,
} from '../../static-data';
import { createDocumentRequestEvent } from '../create-request-event';
import { resolveMiddleware } from '../middleware';
import { runErrorHandlers } from './handle-http-error';

export async function handleDocumentRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Promise<Response> {
  try {
    const response = await withMiddleware(
      request,
      (request) => renderDocument(request.URL, request, manifest),
      resolveMiddleware(manifest, [], 'document'),
    );

    if (isVesselResponse(response)) response.cookies.attach(response.headers);
    return coerceAnyResponse(response);
  } catch (e) {
    const vesselRequest = createVesselRequest(request);

    const handled = await runErrorHandlers(
      vesselRequest,
      e,
      manifest.errorHandlers?.document ?? [],
    );

    if (handled) return handled;

    manifest.devHooks?.onDocumentRenderError?.(vesselRequest, e);

    const error = coerceError(e);

    console.error(
      kleur.bold(kleur.red(`\n🚨 Document Render Error`)),
      `\n\n${kleur.bold('Messsage:')} ${error.message}`,
      url ? `\n${kleur.bold('URL:')} ${url?.pathname}${url?.search}` : '',
      error.stack ? `\n\n${error.stack}` : '',
      '\n',
    );

    if (manifest.dev) {
      return new Response(
        JSON.stringify({
          message: error.message,
          stack: error.stack,
        }),
        { status: 500 },
      );
    }

    return new Response('internal server error', { status: 500 });
  }
}

async function renderDocument(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Promise<VesselResponse> {
  const { render } = await manifest.entry();

  const headers = new Headers();
  const cookies = new Cookies({ url, headers });

  const matches = matchAllRoutes(
    url,
    manifest.routes.document,
    manifest.trailingSlash,
  );

  const loadResults = await loadRoutes(
    url,
    matches,
    async (_, route, type) => {
      const id = resolveStaticDataAssetId(route, type);
      const hashedId = manifest.staticData.serverHashRecord[id] ?? id;
      return (await manifest.staticData.loaders[hashedId]?.())?.data;
    },
    async (url, route, type) => {
      if (!manifest.dev && !route[type]!.canFetch) return;
      return loadServerData({
        url,
        request,
        route,
        type,
        manifest,
        response: { headers, cookies },
      });
    },
  );

  const loadedRoutes: ServerLoadedRoute[] = [];
  const serverData: Record<string, unknown> = {};

  // Look for a redirect backwards because anything earlier in the tree (shallow paths) should "win".
  for (let i = loadResults.length - 1; i >= 0; i--) {
    for (const type of getRouteComponentTypes()) {
      const result = loadResults[i][type];
      const value = resolveSettledPromiseValue(result?.serverData);
      if (value?.redirect) {
        // This won't work yet as client isn't ready so we need to do a network redirect.
        if (isClientRedirectResponse(value.redirect)) {
          value.redirect.headers.set(
            'Location',
            value.redirect.headers.get('X-Vessel-Redirect')!,
          );
        }

        return createVesselResponse(url, value.redirect);
      }
    }
  }

  for (const result of loadResults) {
    const route: Mutable<ServerLoadedRoute> = stripRouteComponentTypes(result);

    for (const type of getRouteComponentTypes()) {
      const compResult = result[type];
      if (!compResult) continue;

      const dataId = route.id + '~' + type;
      const component = {} as Mutable<LoadedRouteComponent>;

      for (const dataKey of getRouteComponentDataKeys()) {
        // Attach first load error to route.
        const reason = resolveSettledPromiseRejection(compResult[dataKey]);

        if (reason) {
          console.error(reason);
          const error = coerceError(reason);

          if (!route.error) {
            route.error = error;
            serverData[dataId] = {
              error: {
                message: error.message,
                stack: manifest.dev ? error.stack : undefined,
              },
            };
          }

          continue;
        }

        if (dataKey === 'module') {
          const value = resolveSettledPromiseValue(compResult[dataKey])!;
          component.module = value;
        } else if (dataKey === 'staticData') {
          const value = resolveSettledPromiseValue(compResult[dataKey])!;
          component.staticData = value;
        } else if (dataKey === 'serverData') {
          const value = resolveSettledPromiseValue(compResult[dataKey]);
          if (value?.data) {
            component.serverData = value.data;
            serverData[dataId] = { data: value.data };
          } else if (value?.error) {
            const error = value.error;
            component.serverLoadError = error;
            serverData[dataId] = {
              error: {
                expected: true,
                message: error.message,
                status: error.status,
                data: error.data,
              },
            };
          }
        }
      }

      route[type] = component;
    }

    loadedRoutes.push(route);
  }

  if (loadedRoutes[0]?.matchedURL.pathname !== url.pathname) {
    const error = new HttpError('not found', 404);

    const serializeError = (routeId) => {
      serverData[routeId + '~page'] = {
        error: {
          message: error.message,
          stack: manifest.dev ? error.stack : undefined,
        },
      };
    };

    if (loadedRoutes[0]) {
      for (let i = loadedRoutes.length - 1; i >= 0; i--) {
        if (i === 0 || loadedRoutes[i].errorBoundary) {
          loadedRoutes[i].error = error;
          serializeError(loadedRoutes[i].id);
          break;
        }
      }
    } else {
      const id = 'root_error_boundary';
      loadedRoutes[0] = {
        id,
        error,
        matchedURL: url,
      } as any;
      serializeError(id);
    }
  }

  const route = loadedRoutes[0];
  const routes = loadedRoutes.reverse();

  const ssr = await render({
    route,
    matches: routes,
    router: createServerRouter(),
  });

  const dataHashScriptTag =
    Object.keys(manifest.staticData.clientHashRecord).length > 0
      ? `<script>__VSL_STATIC_DATA_HASH_MAP__ = JSON.parse(${JSON.stringify(
          JSON.stringify(manifest.staticData.clientHashRecord),
        )});</script>`
      : '';

  const staticDataMap = createStaticLoaderDataMap(loadedRoutes);
  const staticDataScriptTag =
    staticDataMap.size > 0
      ? createStaticDataScriptTag(
          staticDataMap,
          manifest.staticData.serverHashRecord,
        )
      : '';

  const serverDataScriptTag =
    Object.keys(serverData).length > 0
      ? `<script>__VSL_SERVER_DATA__ = JSON.parse(${JSON.stringify(
          JSON.stringify(serverData),
        )});</script>`
      : '';

  const trailingSlashScriptTag = !manifest.trailingSlash
    ? '<script>__VSL_TRAILING_SLASH__ = false;</script>'
    : '';

  const entryScriptTag = `<script type="module" src="${manifest.document.entry}"></script>`;

  const linkTags = createDocumentResourceLinkTags(
    manifest.document.resources.all,
    [
      ...manifest.document.resources.entry,
      ...manifest.document.resources.app,
      ...(manifest.document.resources.routes[route.id] ?? []),
    ],
  );

  const devStylesheet =
    manifest.dev && manifest.document.devStylesheets
      ? await manifest.document.devStylesheets()
      : '';

  const headTags = [...linkTags, devStylesheet, ssr.css ?? '', ssr.head ?? '']
    .filter((t) => t.length > 0)
    .join('\n    ');

  const bodyTags = [
    ssr.body ?? '',
    dataHashScriptTag,
    staticDataScriptTag,
    serverDataScriptTag,
    trailingSlashScriptTag,
    entryScriptTag,
  ]
    .filter((t) => t.length > 0)
    .join('\n    ');

  let html = manifest.document.template
    .replace('<!--@vessel/head-->', headTags)
    .replace('<!--@vessel/body-->', bodyTags)
    .replace(`<!--@vessel/app-->`, ssr.html);

  if (ssr.htmlAttrs) {
    html = html.replace(/<html(.*?)>/, `<html${ssr.htmlAttrs}>`);
  }

  if (ssr.bodyAttrs) {
    html = html.replace(/<body(.*?)>/, `<body${ssr.bodyAttrs}>`);
  }

  const response = new Response(html, {
    headers: {
      'X-Vessel-Page': 'true',
      'Content-Type': 'text/html',
      ETag: `"${generateETag(html)}"`,
    },
  });

  return createVesselResponse(url, response, { headers, cookies });
}

type LoadServerDataInit = {
  url: URL;
  request: Request;
  response: { headers: Headers; cookies: Cookies };
  route: ServerMatchedRoute;
  type: RouteComponentType;
  manifest: ServerManifest;
};

export type LoadServerDataResult = {
  redirect?: Response;
  data?: LoadedServerData;
  error?: HttpError;
};

async function loadServerData({
  request,
  response,
  route,
  type,
  manifest,
}: LoadServerDataInit): Promise<LoadServerDataResult | undefined> {
  const { serverLoader } = await route[type]!.loader();
  if (!serverLoader) return;

  const event = createDocumentRequestEvent({
    request,
    response,
    params: route.params,
    manifest,
  });

  let output: AnyResponse;

  try {
    output = await serverLoader(event);
  } catch (error) {
    if (isRedirectResponse(error)) {
      output = error;
    } else if (isHttpError(error)) {
      return { error };
    } else {
      throw error;
    }
  }

  if (isRedirectResponse(output)) {
    return { redirect: output };
  } else if (isResponse(output)) {
    return { data: await resolveResponseData(output) };
  }

  return { data: output };
}

export function createServerRouter() {
  return new Proxy(
    {},
    {
      get() {
        throw Error('Tried to use client-side router on the server.');
      },
      set() {
        throw Error('Tried to use client-side router on the server.');
      },
    },
  );
}

// Taken from SvelteKit
export function generateETag(html: string) {
  let hash = 5381;
  let i = html.length;

  if (typeof html === 'string') {
    while (i) hash = (hash * 33) ^ html.charCodeAt(--i);
  } else {
    while (i) hash = (hash * 33) ^ html[--i];
  }

  return (hash >>> 0).toString(36);
}

export function createDocumentResourceLinkTags(
  resources: DocumentResource[],
  entries: DocumentResourceEntry[],
) {
  const tags: string[] = [];
  const seen = new Set<number>();

  for (const entry of entries) {
    if (seen.has(entry)) continue;

    const resource = resources[Math.abs(entry)];
    const rel = resolveDocumentResourceRel(resource.href, entry < 0);

    const attrs: string[] = [
      rel ? `rel="${rel}"` : '',
      `href="${resource.href}"`,
    ];

    if (resource.as) attrs.push(`as="${resource.as}"`);
    if (resource.type) attrs.push(`type="${resource.type}"`);
    if (resource.crossorigin) attrs.push(`crossorigin`);

    tags.push(`<link ${attrs.join(' ')} />`);

    seen.add(entry);
  }

  return tags;
}

export function createDocumentResource(
  file: string,
  baseUrl: string,
): DocumentResource {
  const href = `${baseUrl}${slash(file)}`;
  if (file.endsWith('.js')) {
    return { href, as: 'script' };
  } else if (file.endsWith('.css')) {
    return { href, as: 'style' };
  } else if (file.endsWith('.json')) {
    return { href, as: 'fetch', type: 'application/json' };
  } else if (file.endsWith('.woff2')) {
    return { href, as: 'font', type: 'font/woff2' };
  } else if (file.endsWith('.gif')) {
    return { href, as: 'image', type: 'image/gif' };
  } else if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
    return { href, as: 'image', type: 'image/jpeg' };
  } else if (file.endsWith('.png')) {
    return { href, as: 'image', type: 'image/png' };
  } else if (file.endsWith('.mp4')) {
    return { href, as: 'video', type: 'video/mp4' };
  } else if (file.endsWith('.webm')) {
    return { href, as: 'video', type: 'video/webm' };
  } else if (file.endsWith('.mp3')) {
    return { href, as: 'audio', type: 'audio/mp3' };
  } else {
    // TODO: handle all Vite supported assets
    return { href };
  }
}

export function resolveDocumentResourceRel(
  file: string,
  dynamic?: boolean,
): DocumentResource['rel'] {
  if (file.endsWith('.js')) {
    return !dynamic ? 'modulepreload' : 'prefetch';
  } else if (file.endsWith('.css')) {
    return !dynamic ? 'stylesheet' : 'prefetch';
  } else {
    return !dynamic ? 'preload' : 'prefetch';
  }
}
