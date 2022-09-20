import type { ServerManifest, ServerRequestHandler } from 'server/types';

import { json } from './response';

export function createPageHandler(
  manifest: ServerManifest,
): ServerRequestHandler {
  return async (request) => {
    const url = new URL(request.url);

    let response: Response;

    if (url.searchParams.has('route_id')) {
      response = handleDataRequest(url, request, manifest);
    } else {
      response = handlePageRequest(url, request, manifest);
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

export function handleDataRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Response {
  return json({});
}

export function handlePageRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Response {
  // cache router (clear state)
  // this can be an action request
  // const { html: appHtml, head, router } = await render(url, { state, data: staticDataMap });
  // const html = template
  //   .replace(`<!--@vessel/head-->`, head + styles)
  //   .replace(`<!--@vessel/app-->`, appHtml)
  //   .replace('<!--@vessel/body-->', staticDataScript);
  return {} as any;
}
