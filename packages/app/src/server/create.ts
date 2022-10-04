import type { FetchMiddleware, JSONData, RequestParams } from 'shared/http';

import type {
  ServerLoader,
  ServerLoaderOutput,
  ServerRequestHandler,
  ServerRequestHandlerOutput,
  StaticLoader,
} from './types';

export function createStaticLoader<
  Params extends RequestParams = RequestParams,
  Data extends JSONData = JSONData,
>(loader: StaticLoader<Params, Data>) {
  return loader;
}

export function createServerLoader<
  Params extends RequestParams = RequestParams,
  Output extends ServerLoaderOutput = Response,
>(
  loader: ServerLoader<Params, Output>,
  init?: { middleware?: FetchMiddleware[] },
) {
  loader.middleware = init?.middleware;
  return loader;
}

export function createServerRequestHandler<
  Params extends RequestParams = RequestParams,
  Output extends ServerRequestHandlerOutput = Response,
>(
  handler: ServerRequestHandler<Params, Output>,
  init?: { middleware?: FetchMiddleware[] },
) {
  handler.middleware = init?.middleware;
  return handler;
}
