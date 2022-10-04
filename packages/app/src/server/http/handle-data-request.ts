import type { ServerManifest } from 'server/types';
import {
  attachResponseMetadata,
  clientRedirect,
  HttpError,
  isRedirectResponse,
} from 'shared/http';
import { matchRoute } from 'shared/routing';
import type { RouteComponentType } from 'shared/routing/types';

import { handleHttpError } from './handle-http-error';
import { coerceServerRequestHandlerOutput } from './handle-http-request';
import { createServerRequestEvent } from './server-request-event';

export async function handleDataRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Promise<Response> {
  try {
    const routeId = url.searchParams.get('route_id'),
      routeType = url.searchParams.get('route_type') as RouteComponentType;

    const route = manifest.routes.app.find(
      (route) => route.id === routeId && route[routeType],
    );

    if (!route) {
      throw new HttpError('not found', 404);
    }

    const match = matchRoute(url, [route]);

    if (!match) {
      throw new HttpError('not found', 404);
    }

    const mod = await match[routeType]!.loader();
    const { serverLoader } = mod;

    if (!serverLoader) {
      const response = new Response(null, { status: 200 });
      response.headers.set('X-Vessel-Data', 'no');
      return response;
    }

    const event = createServerRequestEvent({
      url,
      request,
      params: match.params,
      manifest,
    });

    const output = await serverLoader(event);

    const response = coerceServerRequestHandlerOutput(output);
    attachResponseMetadata(response, event.response);
    response.headers.set('X-Vessel-Data', 'yes');
    return response;
  } catch (error) {
    if (isRedirectResponse(error)) {
      return clientRedirect(error.headers.get('Location')!, error);
    } else {
      return handleHttpError(error, url, manifest);
    }
  }
}
