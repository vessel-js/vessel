import type { ServerManifest } from 'server/types';
import { HttpError } from 'shared/http';
import { matchRoute } from 'shared/routing';
import type { RouteComponentType } from 'shared/routing/types';

import { handleHttpError } from './errors';
import { createRequestEvent } from './request';
import { isResponse, json } from './response';

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
      const response = new Response(null, {
        status: 200,
      });
      response.headers.set('X-Vessel-Data', 'no');
      return response;
    }

    const event = createRequestEvent({
      url,
      request,
      params: match.params,
      manifest,
    });

    const output = await serverLoader(event);
    const response = isResponse(output) ? output : json(output ?? {});

    for (const [key, value] of event.headers) {
      response.headers.append(key, value);
    }

    event.cookies.serialize(response.headers);

    response.headers.set('X-Vessel-Data', 'yes');
    return response;
  } catch (error) {
    if (isResponse(error)) {
      return error;
    } else {
      return handleHttpError(error, url, manifest);
    }
  }
}
