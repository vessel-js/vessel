import type {
  ServerApiRequestEvent,
  ServerApiRequestEventInit,
  ServerFetch,
  ServerManifest,
  ServerPageRequestEvent,
  ServerPageRequestEventInit,
} from 'server/types';
import {
  coerceFetchInput,
  Cookies,
  createVesselRequest,
  createVesselResponse,
  type RequestParams,
} from 'shared/http';
import { matchRoute } from 'shared/routing';

import { handleApiRequest } from './handlers/handle-api-request';

export function createPageRequestEvent<
  Params extends RequestParams = RequestParams,
>(init: ServerPageRequestEventInit<Params>): ServerPageRequestEvent<Params> {
  const apiEvent = createApiRequestEvent(init);
  const headers = init.response?.headers ?? new Headers();
  const cookies =
    init.response?.cookies ??
    new Cookies({ url: apiEvent.request.URL, headers });
  return {
    ...apiEvent,
    get response() {
      return { headers, cookies };
    },
  };
}

export function createApiRequestEvent<
  Params extends RequestParams = RequestParams,
>(init: ServerApiRequestEventInit<Params>): ServerApiRequestEvent<Params> {
  const request = createVesselRequest(init.request);
  const serverFetch = createServerFetch(request.URL, init.manifest);

  const event: ServerApiRequestEvent<Params> = {
    get params() {
      return init.params;
    },
    get request() {
      return request;
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
): ServerFetch {
  return async (input, init) => {
    const request = coerceFetchInput(input, init, baseURL);
    const requestURL = new URL(request.url);

    if (requestURL.origin === baseURL.origin) {
      const route = matchRoute(requestURL, manifest.routes.api);
      if (route) {
        return createVesselResponse(
          requestURL,
          await handleApiRequest(requestURL, request, route, manifest),
        );
      }
    }

    return createVesselResponse(requestURL, await fetch(request, init));
  };
}
