import type { ServerManifest, ServerMatchedApiRoute } from 'server/types';
import {
  appendHeaders,
  coerceAnyResponse,
  createVesselResponse,
  HTTP_METHOD_RE,
  httpError,
  isRedirectResponse,
  resolveHandlerHttpMethod,
  withMiddleware,
  type HttpMethod,
  type ResponseDetails,
  type VesselRequest,
  type VesselResponse,
} from 'shared/http';
import { isString } from 'shared/utils/unit';

import { createServerRequestEvent } from '../create-request-event';
import { resolveMiddleware } from '../middleware';
import { handleApiError } from './handle-api-error';

export async function handleApiRequest(
  request: VesselRequest,
  route: ServerMatchedApiRoute,
  manifest: ServerManifest,
  page?: ResponseDetails,
): Promise<VesselResponse> {
  try {
    if (
      !request.URL.pathname.startsWith('/__rpc') &&
      !route.pattern.test({ pathname: request.URL.pathname })
    ) {
      throw httpError('route not found', 404);
    }

    let methodOverride: any;
    if (request.method === 'POST') {
      try {
        methodOverride = (await request.formData()).get('_method');
      } catch (error) {
        // no-op
      }
    }

    const method = (
      isString(methodOverride) && HTTP_METHOD_RE.test(methodOverride)
        ? methodOverride
        : request.method
    ) as HttpMethod;

    const handlerId = request.URL.searchParams.get('rpc_handler_id') ?? method;
    const handlerMethod = resolveHandlerHttpMethod(handlerId);

    if (!handlerMethod || (route.methods && !route.methods.includes(handlerMethod))) {
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

    return await withMiddleware(
      request,
      async (request) => {
        const event = createServerRequestEvent({
          request,
          params: route.params,
          page,
          manifest,
        });

        const response = coerceAnyResponse(request.URL, await handler(event));
        appendHeaders(response, event.response.headers);
        event.response.cookies.attach(response);

        return response;
      },
      resolveMiddleware(manifest.middlewares, handler.middleware, 'api'),
    );
  } catch (error) {
    if (isRedirectResponse(error)) {
      return createVesselResponse(request.URL, error);
    } else {
      return handleApiError(request, error, manifest);
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
