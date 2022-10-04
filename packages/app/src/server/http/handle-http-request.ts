import type {
  ServerManifest,
  ServerMatchedHttpRoute,
  ServerRequestHandlerOutput,
} from 'server/types';
import {
  createVesselResponse,
  getAllowedMethods,
  httpError,
  HttpMethod,
  isRedirectResponse,
  isResponse,
  json,
  withMiddleware,
} from 'shared/http';
import { isString } from 'shared/utils/unit';

import { handleHttpError } from './handle-http-error';
import { createServerRequestEvent } from './server-request-event';

export async function handleHttpRequest(
  url: URL,
  request: Request,
  route: ServerMatchedHttpRoute,
  manifest?: ServerManifest,
): Promise<Response> {
  try {
    const methodOverride =
      request.method === 'POST'
        ? (await request.formData()).get('_method')
        : null;

    const method = (
      typeof methodOverride === 'string' ? methodOverride : request.method
    ) as HttpMethod;

    if (route.methods && !route.methods.includes(method)) {
      throw httpError('not found', 404);
    }

    if (!route.pattern.test({ pathname: url.pathname })) {
      throw httpError('not found', 404);
    }

    const mod = await route.loader();

    let handler = mod[method];

    if (!handler && method === 'HEAD') handler = mod.GET;
    if (!handler) handler = mod.ANY;

    if (!handler) {
      throw httpError(`${method} method not allowed`, {
        status: 405,
        headers: {
          // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
          // "The server must generate an Allow header field in a 405 status code response"
          allow: getAllowedMethods(mod).join(', '),
        },
      });
    }

    const response = await withMiddleware(
      request,
      async (request) => {
        const event = createServerRequestEvent({
          url,
          params: route.params,
          request,
          manifest,
        });
        const output = await handler(event);
        const response = coerceServerRequestHandlerOutput(output);
        return createVesselResponse(request.URL, response, event.response);
      },
      handler.middleware,
    );

    response.cookies.attach(response.headers);
    return response;
  } catch (error) {
    if (isRedirectResponse(error)) {
      return error;
    } else {
      return handleHttpError(error, url, manifest);
    }
  }
}

export function coerceServerRequestHandlerOutput(
  output: ServerRequestHandlerOutput,
): Response {
  return isResponse(output)
    ? output
    : isString(output)
    ? new Response(output)
    : json(output ?? {});
}
