import { createVesselRequest, type VesselRequest } from './request';
import { type VesselRequestHandler } from './request-handler';
import { type VesselResponse } from './response';

export type FetchMiddleware = (
  request: VesselRequest,
  next: VesselRequestHandler,
) => VesselResponse | Promise<VesselResponse>;

export type MaybeFetchMiddleware = FetchMiddleware | undefined | null | false;

export function createMiddleware(middleware: FetchMiddleware) {
  return middleware;
}

export type ComposedFetchMiddleware = FetchMiddleware[];

export function composeFetchMiddleware(
  ...middlewares: (MaybeFetchMiddleware | MaybeFetchMiddleware[])[]
): ComposedFetchMiddleware {
  return middlewares
    .flat()
    .filter((middleware) => !!middleware) as ComposedFetchMiddleware;
}

export async function withMiddleware(
  request: Request,
  handler: VesselRequestHandler,
  middlewares: FetchMiddleware[] = [],
) {
  let chain = handler;

  for (let i = middlewares.length - 1; i >= 0; i--) {
    chain = async (request) => middlewares[i](request, chain);
  }

  return chain(createVesselRequest(request));
}
