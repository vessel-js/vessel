import type { ServerManifest } from 'server/types';
import {
  clientRedirect,
  coerceAnyResponse,
  createVesselRequest,
  createVesselResponse,
  HttpError,
  isRedirectResponse,
  isVesselResponse,
  withMiddleware,
} from 'shared/http';
import { matchRoute } from 'shared/routing';
import type { RouteComponentType } from 'shared/routing/types';

import { createPageRequestEvent } from '../create-request-event';
import { resolveMiddleware } from '../middleware';
import { handleApiError } from './handle-api-error';

export async function handleDataRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Promise<Response> {
  try {
    const routeId = url.searchParams.get('route_id'),
      routeType = url.searchParams.get('route_type') as RouteComponentType;

    const route = manifest.routes.pages.find(
      (route) => route.id === routeId && route[routeType],
    );

    if (!route) {
      throw new HttpError('data not found', 404);
    }

    const match = matchRoute(url, [route]);

    if (!match) {
      throw new HttpError('data not found', 404);
    }

    const mod = await match[routeType]!.loader();
    const { serverLoader } = mod;

    if (!serverLoader) {
      const response = new Response(null, { status: 200 });
      response.headers.set('X-Vessel-Data', 'no');
      return response;
    }

    const response = await withMiddleware(
      request,
      async (request) => {
        const event = createPageRequestEvent({
          request,
          params: match.params,
          manifest,
        });
        const anyResponse = await serverLoader(event);
        const response = coerceAnyResponse(anyResponse);
        response.headers.set('X-Vessel-Data', 'yes');
        return createVesselResponse(request.URL, response, event.response);
      },
      resolveMiddleware(manifest.middlewares, serverLoader.middleware, 'api'),
    );

    if (isVesselResponse(response)) response.cookies.attach(response.headers);
    return coerceAnyResponse(response);
  } catch (error) {
    if (isRedirectResponse(error)) {
      return clientRedirect(error.headers.get('Location')!, error);
    } else {
      return handleApiError(error, createVesselRequest(request), manifest);
    }
  }
}
