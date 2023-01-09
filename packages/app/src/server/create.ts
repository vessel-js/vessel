import type { AnyResponse, FetchMiddleware, JSONData, RequestParams } from 'shared/http';

import type { ServerRequestHandler, StaticLoader } from './types';

export function createStaticLoader<
  Params extends RequestParams = RequestParams,
  Data extends JSONData = JSONData,
>(loader: StaticLoader<Params, Data>) {
  return loader;
}

export const createServerLoader = createServerRequestHandler;

export function createServerRequestHandler<
  Params extends RequestParams = RequestParams,
  Response extends AnyResponse = AnyResponse,
>(loader: ServerRequestHandler<Params, Response>, init?: { middleware?: FetchMiddleware[] }) {
  loader.middleware = init?.middleware;
  return loader;
}
