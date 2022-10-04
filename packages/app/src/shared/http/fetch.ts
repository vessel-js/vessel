import type {
  InferServerRequestHandlerData,
  ServerRequestHandler,
  ServerRequestHandlerOutput,
} from 'server/types';

import { type FetchMiddleware } from './middleware';
import {
  createVesselRequest,
  type RequestParams,
  type VesselRequest,
} from './request';
import { createVesselResponse, resolveResponseData } from './response';

export type FetcherInit = {
  middleware?: FetchMiddleware[];
};

export type Fetcher<
  Params extends RequestParams = RequestParams,
  Output extends ServerRequestHandlerOutput = any,
> = (
  init?: RequestInit & {
    params?: Params;
    onLoading?: (isLoading: boolean) => void;
    onError?: (error: unknown) => void;
  },
) => Promise<InferServerRequestHandlerData<Output>>;

export function createFetcher<
  Params extends RequestParams = RequestParams,
  Output extends ServerRequestHandlerOutput = Response,
>(
  input: RequestInfo | URL | ServerRequestHandler<Params, Output>,
  init?: FetcherInit,
): Fetcher<Params, Output> {
  if (typeof input === 'function') {
    throw new Error('[vessel] fetcher RPC call was not transformed');
  }

  if (import.meta.env.SSR) {
    return () => {
      throw new Error('[vessel] fetcher was called server-side');
    };
  }

  return async (fetchInit) => {
    try {
      fetchInit?.onLoading?.(true);

      const baseUrl = new URL(location.href);

      // Array = transformed server RPC call [method: string, path: string]
      const request = Array.isArray(input)
        ? new Request(new URL(input[1], baseUrl), {
            method: input[0],
            ...fetchInit,
          })
        : coerceFetchInput(input, fetchInit, baseUrl);

      if (fetchInit?.params) {
        const url = new URL(request.url);
        for (const key of Object.keys(fetchInit.params)) {
          url.searchParams.append('_params', `${key}=${fetchInit.params[key]}`);
        }
      }

      const response = await callFetch(request, init?.middleware);
      if (!response.ok) throw response;

      const data = await resolveResponseData<any>(response);

      fetchInit?.onLoading?.(false);
      return data;
    } catch (error) {
      fetchInit?.onLoading?.(false);
      if (fetchInit?.onError) {
        fetchInit.onError(error);
      } else {
        throw error;
      }
    }
  };
}

export function coerceFetchInput(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  baseURL: URL,
) {
  return input instanceof Request
    ? input
    : new Request(
        typeof input === 'string' ? new URL(input, baseURL) : input,
        init,
      );
}

export async function callFetch(
  request: Request,
  middlewares: FetchMiddleware[] = [],
) {
  let chain = async (request: VesselRequest) => {
    const fetchRequest = new Request(request.URL, request);
    request.cookies.serialize(fetchRequest.headers);
    return createVesselResponse(request.URL, await fetch(fetchRequest));
  };

  for (let i = middlewares.length - 1; i >= 0; i--) {
    chain = async (request) => middlewares[i](request, chain);
  }

  return chain(createVesselRequest(request));
}

// From: https://github.com/whatwg/fetch/issues/905#issuecomment-491970649
export function composeAbortSignals(
  ...signals: (AbortSignal | null | undefined)[]
) {
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
