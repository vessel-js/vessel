import type { JSONData, RequestParams } from './http';
import type { MaybeStaticLoaderOutput, StaticLoaderInput } from './types';

export function createStaticLoader<
  Params extends RequestParams = RequestParams,
  Data extends JSONData = JSONData,
>(
  loader: (
    input: StaticLoaderInput<Params>,
  ) => MaybeStaticLoaderOutput<Data> | Promise<MaybeStaticLoaderOutput<Data>>,
) {
  return loader;
}
