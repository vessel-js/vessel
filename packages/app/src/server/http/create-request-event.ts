import type {
  ServerDocumentRequestEvent,
  ServerDocumentRequestEventInit,
  ServerFetch,
  ServerHttpRequestEvent,
  ServerHttpRequestEventInit,
  ServerManifest,
} from 'server/types';
import {
  coerceFetchInput,
  Cookies,
  createVesselRequest,
  createVesselResponse,
  type RequestParams,
} from 'shared/http';
import { matchRoute } from 'shared/routing';

import { handleHttpRequest } from './handlers/handle-http-request';

export function createDocumentRequestEvent<
  Params extends RequestParams = RequestParams,
>(
  init: ServerDocumentRequestEventInit<Params>,
): ServerDocumentRequestEvent<Params> {
  const httpEvent = createHttpRequestEvent(init);
  const headers = init.response?.headers ?? new Headers();
  const cookies =
    init.response?.cookies ??
    new Cookies({ url: httpEvent.request.URL, headers });
  return {
    ...httpEvent,
    get response() {
      return { headers, cookies };
    },
  };
}

export function createHttpRequestEvent<
  Params extends RequestParams = RequestParams,
>(init: ServerHttpRequestEventInit<Params>): ServerHttpRequestEvent<Params> {
  const request = createVesselRequest(init.request);
  const serverFetch = createServerFetch(request.URL, init.manifest);

  const event: ServerHttpRequestEvent<Params> = {
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
      const route = matchRoute(requestURL, manifest.routes.http);
      if (route) {
        return createVesselResponse(
          requestURL,
          await handleHttpRequest(requestURL, request, route, manifest),
        );
      }
    }

    return createVesselResponse(requestURL, await fetch(request, init));
  };
}
