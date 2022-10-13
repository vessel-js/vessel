import type {
  InferApiHandlerData,
  InferApiHandlerParams,
  SerializedServerRPC,
  ServerRPC,
} from 'server/types';
import { isArray, isFunction } from 'shared/utils/unit';

import { type FetchMiddleware, withMiddleware } from './middleware';
import { type RequestParams, type VesselRequest } from './request';
import {
  coerceAnyResponse,
  createVesselResponse,
  resolveResponseData,
} from './response';

export type VesselFetch<RPC extends ServerRPC = any> = (
  init?: VesselFetchInit<InferApiHandlerParams<RPC>>,
) => Promise<InferApiHandlerData<RPC>>;

export type VesselFetchInit<Params = RequestParams> = RequestInit & {
  params?: Params;
  searchParams?: URLSearchParams;
  onLoading?: (isLoading: boolean) => void;
  onError?: (error: unknown) => void;
};

export function createFetch<RPC extends ServerRPC = any>(
  input: string | Request | URL | RPC,
  init?: { middleware?: FetchMiddleware[] },
): VesselFetch<RPC> {
  if (import.meta.env.SSR) {
    return () => {
      throw new Error(
        '[vessel] fetch created with `createFetch` was called server-side',
      );
    };
  }

  return async (fetchInit) => {
    try {
      fetchInit?.onLoading?.(true);

      const baseURL = new URL(location.origin);
      const request = coerceFetchInput(input, fetchInit, baseURL);
      const url = new URL(request.url);

      if (fetchInit?.searchParams) {
        for (const [key, value] of fetchInit.searchParams) {
          url.searchParams.append(key, value);
        }
      }

      if (fetchInit?.params) {
        for (const key of Object.keys(fetchInit.params)) {
          url.searchParams.append(
            'rpc_params',
            `${key}=${fetchInit.params[key]}`,
          );
        }
      }

      const response = coerceAnyResponse(
        await withMiddleware(
          new Request(url, request),
          vesselFetch,
          init?.middleware,
        ),
      );

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
  input: RequestInfo | URL | ServerRPC | SerializedServerRPC,
  init: RequestInit | undefined,
  baseURL: URL,
) {
  if (isFunction(input)) {
    throw Error('[vessel] fetch RPC call was not transformed');
  }

  return input instanceof Request
    ? input
    : isArray(input)
    ? new Request(new URL(input[1], baseURL), { ...init, method: input[0] })
    : new Request(
        typeof input === 'string' ? new URL(input, baseURL) : input,
        init,
      );
}

async function vesselFetch(request: VesselRequest) {
  const fetchRequest = new Request(request.URL, request);
  request.cookies.attach(fetchRequest.headers);
  return createVesselResponse(request.URL, await fetch(fetchRequest));
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
