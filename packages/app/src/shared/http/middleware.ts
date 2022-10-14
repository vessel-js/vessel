import { type VesselRequest } from './request';
import { type VesselRequestHandler } from './request-handler';
import {
  type AnyResponse,
  coerceAnyResponse,
  type VesselResponse,
} from './response';

export type FetchMiddleware = (
  request: VesselRequest,
  next: (request: VesselRequest) => Promise<VesselResponse>,
) => AnyResponse | Promise<AnyResponse>;

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
  request: VesselRequest,
  handler: VesselRequestHandler,
  middlewares: FetchMiddleware[] = [],
) {
  let chain = handler;

  for (let i = middlewares.length - 1; i >= 0; i--) {
    const next = chain;
    chain = async (request) =>
      middlewares[i](request, async (request: VesselRequest) =>
        coerceAnyResponse(request.URL, await next(request)),
      );
  }

  return coerceAnyResponse(request.URL, await chain(request));
}
