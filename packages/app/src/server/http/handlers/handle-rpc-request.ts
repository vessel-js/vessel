import type { ServerManifest } from 'server/types';
import { json, VesselRequest, type RequestParams } from 'shared/http';

import { handleApiRequest } from './handle-api-request';

export async function handleRPCRequest(
  request: VesselRequest,
  manifest: ServerManifest,
): Promise<Response> {
  const routeId = request.URL.searchParams.get('rpc_route_id'),
    params: RequestParams = {};

  const route = routeId && manifest.routes.api.find((route) => route.id === routeId);

  if (!route) {
    return json({ error: { message: 'route not found' } }, 404);
  }

  const searchParams = request.URL.searchParams.getAll('rpc_params');
  if (searchParams) {
    for (const param of searchParams) {
      const index = param.indexOf('=');
      const key = param.substring(0, index);
      params[key] = param.substring(index + 1);
    }
  }

  const matchedRoute = {
    ...route,
    matchedURL: request.URL,
    params,
  };

  return handleApiRequest(request, matchedRoute, manifest);
}
