import type { ServerManifest } from 'server/types';
import {
  clientRedirect,
  coerceAnyResponse,
  createVesselRequest,
  createVesselResponse,
  HttpError,
  isRedirectResponse,
  withMiddleware,
} from 'shared/http';
import { matchRoute } from 'shared/routing';
import type { RouteComponentType } from 'shared/routing/types';

import { resolveMiddleware } from '../middleware';
import { createServerRequestEvent } from '../request-event';
import { handleHttpError } from './handle-http-error';

export async function handleDataRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Promise<Response> {
  try {
    const routeId = url.searchParams.get('route_id'),
      routeType = url.searchParams.get('route_type') as RouteComponentType;

    const route = manifest.routes.document.find(
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
        const event = createServerRequestEvent({
          url: request.URL,
          request,
          params: match.params,
          manifest,
        });
        const anyResponse = await serverLoader(event);
        const response = coerceAnyResponse(anyResponse);
        response.headers.set('X-Vessel-Data', 'yes');
        return createVesselResponse(request.URL, response, event.pageResponse);
      },
      resolveMiddleware(manifest, serverLoader.middleware, 'api'),
    );

    if (response.cookies) response.cookies.attach(response.headers);
    return response;
  } catch (error) {
    if (isRedirectResponse(error)) {
      return clientRedirect(error.headers.get('Location')!, error);
    } else {
      return handleHttpError(error, createVesselRequest(request), manifest);
    }
  }
}
