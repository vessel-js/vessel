import type {
  ServerFetch,
  ServerManifest,
  ServerRequestEvent,
  ServerRequestEventInit,
} from 'server/types';
import {
  coerceFetchInput,
  createResponseDetails,
  createVesselResponse,
  type RequestParams,
  type ResponseDetails,
} from 'shared/http';
import { matchRoute } from 'shared/routing';
import { isFunction } from 'shared/utils/unit';

import { handleApiRequest } from './handlers/handle-api-request';

export function createServerRequestEvent<Params extends RequestParams = RequestParams>(
  init: ServerRequestEventInit<Params>,
): ServerRequestEvent<Params> {
  const request = init.request;
  const response = createResponseDetails(request.URL);
  const serverFetch = createServerFetch(request.URL, init.manifest, init.page);

  const event: ServerRequestEvent<Params> = {
    get params() {
      return init.params;
    },
    get request() {
      return request;
    },
    get response() {
      return response;
    },
    get page() {
      return init.page;
    },
    get serverFetch() {
      return serverFetch;
    },
  };

  return event;
}

export function createServerFetch(
  baseURL: URL,
  manifest: ServerManifest,
  page?: ResponseDetails,
): ServerFetch {
  return async (input, init) => {
    if (isFunction(input) && !input.rpc) {
      throw Error('[vessel] server fetch RPC call was not transformed');
    }

    const request = coerceFetchInput(isFunction(input) ? input.rpc! : input, init, baseURL);

    if (request.URL.origin === baseURL.origin) {
      const route = matchRoute(request.URL, manifest.routes.api);
      if (route) return handleApiRequest(request, route, manifest, page);
    }

    return createVesselResponse(request.URL, await fetch(request, init)) as any;
  };
}
