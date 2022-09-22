import {
  createStaticDataScriptTag,
  createStaticLoaderDataMap,
} from 'server/static-data';
import type {
  ServerLoadedRoute,
  ServerLoaderOutput,
  ServerManifest,
  ServerMatchedRoute,
  ServerRequestHandler,
} from 'server/types';
import { HttpError, isHttpError, resolveServerResponseData } from 'shared/http';
import {
  getRouteComponentDataKeys,
  getRouteComponentTypes,
  type LoadedRouteComponent,
  type LoadedServerData,
  loadRoutes,
  matchAllRoutes,
  matchRoute,
  normalizeURL,
  resolveSettledPromiseRejection,
  resolveSettledPromiseValue,
  type RouteComponentType,
  stripRouteComponentTypes,
} from 'shared/routing';
import type { Mutable } from 'shared/types';
import { coerceToError } from 'shared/utils/error';

import { Cookies } from './cookies';
import { handleHttpError } from './errors';
import { createRequestEvent } from './request';
import { isRedirectResponse, isResponse, json } from './response';

export function createPageHandler(
  manifest: ServerManifest,
): ServerRequestHandler {
  return async (request) => {
    const url = normalizeURL(new URL(request.url), manifest.trailingSlash);

    let response: Response;

    if (url.searchParams.has('route_id')) {
      response = await handleDataRequest(url, request, manifest);
    } else {
      response = await handlePageRequest(url, request, manifest);
    }

    if (request.method === 'HEAD') {
      return new Response(null, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response;
  };
}

export async function handleDataRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Promise<Response> {
  try {
    const routeId = url.searchParams.get('route_id'),
      routeType = url.searchParams.get('route_type') as RouteComponentType;

    const route = manifest.routes.app.find(
      (route) => route.id === routeId && route[routeType],
    );

    if (!route) {
      throw new HttpError('not found', 404);
    }

    const match = matchRoute(url, [route]);

    if (!match) {
      throw new HttpError('not found', 404);
    }

    const mod = await match[routeType]!.loader();
    const { serverLoader } = mod;

    if (!serverLoader) {
      const response = new Response(null, {
        status: 200,
      });
      response.headers.set('X-Vessel-Data', 'no');
      return response;
    }

    const event = createRequestEvent({
      url,
      request,
      params: match.params,
      manifest,
    });

    const output = await serverLoader(event);
    const response = isResponse(output) ? output : json(output ?? {});

    for (const [key, value] of event.headers) {
      response.headers.append(key, value);
    }

    event.cookies.serialize(response.headers);

    response.headers.set('X-Vessel-Data', 'yes');
    return response;
  } catch (error) {
    if (isResponse(error)) {
      return error;
    } else {
      return handleHttpError(error, manifest.dev);
    }
  }
}

export async function handlePageRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Promise<Response> {
  try {
    return await renderPage(url, request, manifest);
  } catch (err) {
    if (manifest.dev) {
      const error = coerceToError(err);
      return new Response(error.stack, { status: 500 });
    }

    // TODO: this shouldn't happen but is there a more appropriate course of action?
    // Maybe a HTML error page the user can provide for this case?
    return new Response('internal server error', { status: 500 });
  }
}

export async function renderPage(
  url: URL,
  request: Request,
  manifest: ServerManifest,
) {
  const { render } = await manifest.entry();

  const headers = new Headers();
  const cookies = new Cookies({ url });
  const matches = matchAllRoutes(url, manifest.routes.app);

  const loadResults = await loadRoutes(
    url,
    matches,
    manifest.staticData.loader,
    (url, route, type) => {
      return loadServerData({
        url,
        request,
        route,
        type,
        headers,
        cookies,
        manifest,
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
        return new Response(null, {
          status: value.redirect.status,
          headers: { Location: value.redirect.path },
        });
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
          const error = coerceToError(reason);

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

  if (loadedRoutes.length === 0) {
    loadedRoutes[0] = {
      id: 'root_error_boundary',
      url,
      error: new HttpError('not found', 404),
    } as any;
  }

  const route = loadedRoutes[0];
  const routes = loadedRoutes.reverse();

  const ssr = await render({
    route,
    matches: routes,
    router: createServerRouter(),
  });

  const dataHashScriptTag =
    manifest.staticData.hashMap.length > 0
      ? `<script>__VSL_STATIC_DATA_HASH_MAP__ = JSON.parse(${manifest.staticData.hashMap});</script>`
      : '';

  const staticDataMap = createStaticLoaderDataMap(
    loadedRoutes,
    manifest.staticData.hashRecord,
  );

  const staticDataScriptTag =
    staticDataMap.size > 0 ? createStaticDataScriptTag(staticDataMap) : '';

  const serverDataScriptTag =
    Object.keys(serverData).length > 0
      ? `<script>__VSL_SERVER_DATA__ = JSON.parse(${JSON.stringify(
          JSON.stringify(serverData),
        )});</script>`
      : '';

  const trailingSlashScriptTag = !manifest.trailingSlash
    ? '<script>__VSL_TRAILING_SLASH__ = false;</script>'
    : '';

  const entryScriptTag = `<script type="module" src="${manifest.html.entry}"></script>`;

  const html = manifest.html.template
    .replace(
      '<!--@vessel/head-->',
      manifest.html.stylesheet +
        (ssr.css ?? '') +
        (manifest.html.preload[route.id] ?? '') +
        (manifest.html.prefetch[route.id] ?? '') +
        (ssr.head ?? ''),
    )
    .replace(
      '<!--@vessel/body-->',
      dataHashScriptTag +
        staticDataScriptTag +
        serverDataScriptTag +
        trailingSlashScriptTag +
        entryScriptTag,
    )
    .replace(`<!--@vessel/app-->`, ssr.html);

  const response = new Response(html, {
    headers: {
      'X-Vessel-Page': 'true',
      'Content-Type': 'text/html',
      ETag: `"${generateETag(html)}"`,
    },
  });

  for (const [key, value] of headers) {
    response.headers.append(key, value);
  }

  cookies.serialize(response.headers);

  return response;
}

type LoadServerDataInit = {
  url: URL;
  request: Request;
  route: ServerMatchedRoute;
  type: RouteComponentType;
  headers: Headers;
  cookies: Cookies;
  manifest: ServerManifest;
};

export type LoadServerDataResult = {
  redirect?: { path: string; status: number };
  data?: LoadedServerData;
  error?: HttpError;
};

async function loadServerData({
  url,
  request,
  route,
  type,
  headers,
  cookies,
  manifest,
}: LoadServerDataInit): Promise<LoadServerDataResult | undefined> {
  const { serverLoader } = await route[type]!.loader();
  if (!serverLoader) return;

  const event = createRequestEvent({
    url,
    request,
    params: route.params,
    headers,
    cookies,
    manifest,
  });

  let output: ServerLoaderOutput;

  try {
    output = await serverLoader(event);
  } catch (error) {
    if (isResponse(error)) {
      output = error;
    } else if (isHttpError(error)) {
      return { error };
    } else {
      throw error;
    }
  }

  if (isResponse(output)) {
    if (isRedirectResponse(output)) {
      return {
        redirect: {
          path: output.headers.get('Location')!,
          status: output.status,
        },
      };
    } else {
      const data = await resolveServerResponseData(output);
      return { data };
    }
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
