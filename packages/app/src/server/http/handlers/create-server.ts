import type { ServerManifest } from 'server/types';
import {
  HTML_DOCUMENT_HTTP_METHOD,
  json,
  redirect,
  type RequestHandler,
} from 'shared/http';
import { matchRoute } from 'shared/routing';
import { noendslash } from 'shared/utils/url';

import { addURLPattern, installServerConfig } from '../app/configure-server';
import { handleDataRequest } from './handle-data-request';
import { handleDocumentRequest } from './handle-document-request';
import { handleHttpRequest } from './handle-http-request';
import { handleRPCRequest } from './handle-rpc-request';

export function createServer(manifest: ServerManifest): RequestHandler {
  if (!manifest.dev) {
    initManifestURLPatterns(manifest);
  }

  if (manifest.configs) {
    for (const config of manifest.configs) {
      installServerConfig(manifest, config);
    }
  }

  return async (request) => {
    const url = new URL(request.url);

    const redirect = resolveTrailingSlashRedirect(url, manifest.trailingSlash);
    if (redirect) return redirect;

    let response: Response;

    const method = request.method;
    const accepts = request.headers.get('Accept');
    const acceptsHTML = accepts && /\btext\/html\b/.test(accepts);

    if (url.pathname.startsWith('/__rpc')) {
      response = await handleRPCRequest(url, request, manifest);
    } else if (url.searchParams.has('__data')) {
      response = await handleDataRequest(url, request, manifest);
    } else if (acceptsHTML && HTML_DOCUMENT_HTTP_METHOD.has(method)) {
      response = await handleDocumentRequest(url, request, manifest);
    } else {
      const route = matchRoute(url, manifest.routes.http);
      if (route) {
        response = await handleHttpRequest(url, request, route, manifest);
      } else {
        response = json({ error: { message: 'route not found' } }, 404);
      }
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

export function initManifestURLPatterns(manifest: ServerManifest) {
  Object.keys(manifest.routes)
    .flatMap((key) => manifest.routes[key])
    .forEach(addURLPattern);
}
