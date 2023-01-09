import type { ServerManifest } from 'server/types';
import {
  createVesselRequest,
  HTML_DOCUMENT_HTTP_METHOD,
  isVesselResponse,
  json,
  redirect,
  type RequestHandler,
} from 'shared/http';
import { matchRoute } from 'shared/routing';
import { noendslash } from 'shared/utils/url';

import { addURLPattern, installServerConfigs } from './app/configure-server';
import { handleApiRequest } from './handlers/handle-api-request';
import { handleDataRequest } from './handlers/handle-data-request';
import { handlePageRequest } from './handlers/handle-page-request';
import { handleRPCRequest } from './handlers/handle-rpc-request';

export function createServer(manifest: ServerManifest): RequestHandler {
  initServerManifest(manifest);

  return async (req) => {
    const request = createVesselRequest(req);

    const redirect = resolveTrailingSlashRedirect(request.URL, manifest.trailingSlash);

    if (redirect) return redirect;

    let response: Response;

    const method = request.method;
    const accepts = request.headers.get('Accept');
    const acceptsHTML = accepts && /\btext\/html\b/.test(accepts);

    if (request.URL.pathname.startsWith('/__rpc')) {
      response = await handleRPCRequest(request, manifest);
    } else if (request.URL.searchParams.has('__data')) {
      response = await handleDataRequest(request, manifest);
    } else if (acceptsHTML && HTML_DOCUMENT_HTTP_METHOD.has(method)) {
      response = await handlePageRequest(request, manifest);
    } else {
      const route = matchRoute(request.URL, manifest.routes.api);
      if (route) {
        response = await handleApiRequest(request, route, manifest);
      } else {
        response = json({ error: { message: 'route not found' } }, 404);
      }
    }

    if (isVesselResponse(response)) {
      response.cookies.attach(response);
    }

    if (method === 'HEAD') {
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

function initServerManifest(manifest: ServerManifest) {
  initManifestURLPatterns(manifest);
  installServerConfigs(manifest);
}

export function initManifestURLPatterns(manifest: ServerManifest) {
  Object.keys(manifest.routes)
    .flatMap((key) => manifest.routes[key])
    .forEach(addURLPattern);
}
