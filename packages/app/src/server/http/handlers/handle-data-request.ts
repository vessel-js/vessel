import type { ServerManifest } from 'server/types';
import {
  appendHeaders,
  clientRedirect,
  coerceAnyResponse,
  HttpError,
  isRedirectResponse,
  type VesselRequest,
  withMiddleware,
} from 'shared/http';
import { matchRoute } from 'shared/routing';
import type { RouteComponentType } from 'shared/routing/types';

import { createServerRequestEvent } from '../create-request-event';
import { resolveMiddleware } from '../middleware';
import { handleApiError } from './handle-api-error';

export async function handleDataRequest(
  request: VesselRequest,
  manifest: ServerManifest,
): Promise<Response> {
  try {
    const routeId = request.URL.searchParams.get('route_id'),
      routeType = request.URL.searchParams.get(
        'route_type',
      ) as RouteComponentType;

    const route = manifest.routes.pages.find(
      (route) => route.id === routeId && route[routeType],
    );

    if (!route) {
      throw new HttpError('data not found', 404);
    }

    const match = matchRoute(request.URL, [route]);

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
        const event = createServerRequestEvent({
          request,
          params: match.params,
          manifest,
        });

        const response = coerceAnyResponse(
          request.URL,
          await serverLoader(event),
        );

        response.headers.set('X-Vessel-Data', 'yes');
        appendHeaders(response, event.response.headers);
        event.response.cookies.attach(response);

        return response;
      },
      resolveMiddleware(manifest.middlewares, serverLoader.middleware, 'api'),
    );

    return response;
  } catch (error) {
    if (isRedirectResponse(error)) {
      return clientRedirect(error.headers.get('Location')!, error);
    } else {
      return handleApiError(request, error, manifest);
    }
  }
}
