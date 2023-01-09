import { isArray, isFunction } from 'shared/utils/unit';

import { tryResolveResponseError } from './errors';
import { createVesselRequest, type RequestParams } from './request';
import { createVesselResponse } from './response';
import type { InferRPCParams, InferRPCResponse, RPCFetchInfo, RPCHandler } from './rpc';

export type ClientFetchInit<Params = RequestParams> = RequestInit & {
  params?: Params;
  searchParams?: URLSearchParams;
};

export async function clientFetch<RPC extends RPCHandler>(
  input: string | Request | URL | RPC,
  init?: ClientFetchInit<InferRPCParams<RPC>>,
): Promise<InferRPCResponse<RPC>> {
  if (import.meta.env.SSR) {
    throw new Error('[vessel] client fetch was called server-side');
  }

  const request = coerceFetchInput(input, init, new URL(location.origin));
  request.cookies.attach(request);

  const response = createVesselResponse(request.URL, await fetch(request));

  const error = tryResolveResponseError(response);
  if (error) throw error;

  if (!response.ok) throw response;
  return response as any;
}

export type ClientFetcher<RPC extends RPCHandler> = (
  init?: ClientFetchInit<InferRPCParams<RPC>>,
) => Promise<InferRPCResponse<RPC>>;

export function createClientFetcher<RPC extends RPCHandler>(
  input: string | Request | URL | RPC,
): ClientFetcher<RPC> {
  return (init) => clientFetch(input, init);
}

export function coerceFetchInput(
  input: RequestInfo | URL | RPCHandler | RPCFetchInfo,
  init: ClientFetchInit | undefined,
  baseURL: URL,
) {
  if (isFunction(input)) {
    throw Error('[vessel] fetch RPC call was not transformed');
  }

  const request = createVesselRequest(
    input instanceof Request
      ? input
      : isArray(input)
      ? new Request(new URL(input[1], baseURL), { ...init, method: input[0] })
      : new Request(typeof input === 'string' ? new URL(input, baseURL) : input, init),
  );

  if (init?.params) {
    for (const key of Object.keys(init.params)) {
      request.URL.searchParams.append('rpc_params', `${key}=${init.params[key]}`);
    }
  }

  if (init?.searchParams) {
    for (const [key, value] of request.URL.searchParams) {
      request.URL.searchParams.append(key, value);
    }
  }

  return request;
}

// From: https://github.com/whatwg/fetch/issues/905#issuecomment-491970649
export function composeAbortSignals(...signals: (AbortSignal | null | undefined)[]) {
  const controller = new AbortController();

  function onAbort() {
    controller.abort();
    for (const signal of signals) {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  for (const signal of signals) {
    if (signal?.aborted) {
      onAbort();
      break;
    }

    signal?.addEventListener('abort', onAbort);
  }

  return controller.signal;
}
