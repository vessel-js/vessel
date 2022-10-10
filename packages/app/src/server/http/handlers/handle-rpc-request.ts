import type { ServerManifest } from 'server/types';
import { json, type RequestParams } from 'shared/http';

import { handleApiRequest } from './handle-api-request';

export async function handleRPCRequest(
  url: URL,
  request: Request,
  manifest: ServerManifest,
): Promise<Response> {
  const routeId = url.searchParams.get('rpc_route_id'),
    params: RequestParams = {};

  const route =
    routeId && manifest.routes.api.find((route) => route.id === routeId);

  if (!route) {
    return json({ error: { message: 'route not found' } }, 404);
  }

  const searchParams = url.searchParams.getAll('rpc_params');
  if (searchParams) {
    for (const param of searchParams) {
      const index = param.indexOf('=');
      const key = param.substring(0, index);
      params[key] = param.substring(index + 1);
    }
  }

  const matchedRoute = {
    ...route,
    matchedURL: url,
    params,
  };

  return handleApiRequest(url, request, matchedRoute, manifest);
}
