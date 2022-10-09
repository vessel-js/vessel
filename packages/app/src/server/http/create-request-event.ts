import type {
  DocumentRequestEvent,
  DocumentRequestEventInit,
  HttpRequestEvent,
  HttpRequestEventInit,
  ServerFetch,
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
>(init: DocumentRequestEventInit<Params>): DocumentRequestEvent<Params> {
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
>(init: HttpRequestEventInit<Params>): HttpRequestEvent<Params> {
  let serverFetch: ServerFetch | null = null;
  const request = createVesselRequest(init.request);

  const event: HttpRequestEvent<Params> = {
    get params() {
      return init.params;
    },
    get request() {
      return request;
    },
    get serverFetch() {
      if (!serverFetch) {
        throw Error('`serverFetch` is not available.');
      }

      return serverFetch;
    },
  };

  serverFetch = init.manifest
    ? createServerFetch(request.URL, init.manifest)
    : null;

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
