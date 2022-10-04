import type { ServerManifest } from 'server/types';
import { redirect, type RequestHandler } from 'shared/http';
import { matchRoute } from 'shared/routing';
import { noendslash } from 'shared/utils/url';

import { handleDataRequest } from './handle-data-request';
import { handleDocumentRequest } from './handle-document-request';
import { handleHttpRequest } from './handle-http-request';

export function createRequestHandler(manifest: ServerManifest): RequestHandler {
  if (!manifest.dev) {
    initManifestURLPatterns(manifest);
  }

  return async (request) => {
    const url = new URL(request.url);

    const redirect = resolveTrailingSlashRedirect(url, manifest.trailingSlash);
    if (redirect) return redirect;

    let response: Response;

    const httpRoute = matchRoute(url, manifest.routes.http);
    if (httpRoute) {
      response = await handleHttpRequest(url, request, httpRoute, manifest);
    } else if (url.searchParams.has('_data')) {
      response = await handleDataRequest(url, request, manifest);
    } else {
      response = await handleDocumentRequest(url, request, manifest);
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

function resolveTrailingSlashRedirect(url: URL, trailingSlash: boolean) {
  if (url.pathname === '/') {
    return false;
  } else if (url.pathname.endsWith('/index.html')) {
    const cleanHref = url.href.replace('/index.html', trailingSlash ? '/' : '');
    return redirect(cleanHref, 308);
  } else if (!trailingSlash && url.pathname.endsWith('/')) {
    url.pathname = noendslash(url.pathname);
    return redirect(url.href, 308);
  } else if (trailingSlash && !url.pathname.endsWith('/')) {
    url.pathname = url.pathname + '/';
    return redirect(url.href, 308);
  }

  return false;
}

export function initManifestURLPatterns(manifest: ServerManifest) {
  Object.keys(manifest.routes)
    .flatMap((key) => manifest.routes[key])
    .forEach((route) => {
      route.pattern = new URLPattern({ pathname: route.pathname });
    });
}
