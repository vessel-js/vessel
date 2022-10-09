import type { ServerManifest, ServerMatchedHttpRoute } from 'server/types';
import {
  coerceAnyResponse,
  createVesselRequest,
  createVesselResponse,
  httpError,
  type HttpMethod,
  isRedirectResponse,
  isVesselResponse,
  resolveHandlerHttpMethod,
  withMiddleware,
} from 'shared/http';

import { createHttpRequestEvent } from '../create-request-event';
import { resolveMiddleware } from '../middleware';
import { handleHttpError } from './handle-http-error';

export async function handleHttpRequest(
  url: URL,
  request: Request,
  route: ServerMatchedHttpRoute,
  manifest: ServerManifest,
): Promise<Response> {
  try {
    if (
      !url.pathname.startsWith('/__rpc') &&
      !route.pattern.test({ pathname: url.pathname })
    ) {
      throw httpError('route not found', 404);
    }

    const methodOverride =
      request.method === 'POST'
        ? (await request.formData()).get('_method')
        : null;

    const method = (
      typeof methodOverride === 'string' ? methodOverride : request.method
    ) as HttpMethod;

    const handlerId = url.searchParams.get('rpc_handler_id') ?? method;
    const handlerMethod = resolveHandlerHttpMethod(handlerId);

    if (
      !handlerMethod ||
      (route.methods && !route.methods.includes(handlerMethod))
    ) {
      throw httpError(`${method} method not allowed`, {
        status: 405,
        headers: {
          // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
          // "The server must generate an Allow header field in a 405 status code response"
          allow: route.methods
            ? route.methods.join(', ')
            : getAllowedHttpMethods(await route.loader()).join(', '),
        },
      });
    }

    const mod = await route.loader();

    let handler = mod[handlerId];
    if (!handler && handlerId === 'HEAD') handler = mod.GET;
    if (!handler) handler = mod.ANY;
    if (!handler) throw httpError('route not found', 404);

    const response = await withMiddleware(
      request,
      async (request) => {
        const event = createHttpRequestEvent({
          request,
          params: route.params,
          manifest,
        });
        const anyResponse = await handler(event);
        const response = coerceAnyResponse(anyResponse);
        return createVesselResponse(request.URL, response);
      },
      resolveMiddleware(manifest.middlewares, handler.middleware, 'api'),
    );

    if (isVesselResponse(response)) response.cookies.attach(response.headers);
    return coerceAnyResponse(response);
  } catch (error) {
    if (isRedirectResponse(error)) {
      return error;
    } else {
      return handleHttpError(error, createVesselRequest(request), manifest);
    }
  }
}

export function getAllowedHttpMethods(mod: Record<string, unknown>) {
  const allowed: string[] = [];

  for (const id of Object.keys(mod)) {
    const method = resolveHandlerHttpMethod(id);
    if (method) allowed.push(method);
  }

  if (mod.GET || mod.HEAD) allowed.push('HEAD');

  return allowed;
}
