import { type VesselRequest } from './request';
import { type VesselResponse } from './response';

export type FetchMiddleware = (
  request: VesselRequest,
  next: (request: VesselRequest) => VesselResponse | Promise<VesselResponse>,
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
