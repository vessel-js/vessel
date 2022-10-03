import type { JSONData, RequestParams } from './http';
import type { ServerLoader, StaticLoader } from './types';

export function createStaticLoader<
  Params extends RequestParams = RequestParams,
  Data extends JSONData = JSONData,
>(loader: StaticLoader<Params, Data>) {
  return loader;
}

export function createServerLoader<
  Params extends RequestParams = RequestParams,
>(loader: ServerLoader<Params>) {
  return loader;
}
