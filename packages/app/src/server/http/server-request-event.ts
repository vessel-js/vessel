import type {
  ServerFetcher,
  ServerManifest,
  ServerRequestEvent,
  ServerRequestEventInit,
} from 'server/types';
import {
  coerceFetchInput,
  Cookies,
  createVesselRequest,
  httpError,
  type RequestParams,
} from 'shared/http';
import { matchRoute } from 'shared/routing';

import { handleHttpError } from './handle-http-error';
import { handleHttpRequest } from './handle-http-request';

export function createServerRequestEvent<
  Params extends RequestParams = RequestParams,
>(init: ServerRequestEventInit<Params>): ServerRequestEvent<Params> {
  init.request = createVesselRequest(init.request);

  const responseHeaders = init.response?.headers ?? new Headers();

  const responseCookies =
    init.response?.cookies ??
    new Cookies({ url: init.url, headers: responseHeaders });

  let fetcher: ServerFetcher | null = null;

  const event: ServerRequestEvent<Params> = {
    get params() {
      return init.params;
    },
    get request() {
      return init.request as ServerRequestEvent<Params>['request'];
    },
    get response() {
      return {
        headers: responseHeaders,
        cookies: responseCookies,
      };
    },
    get fetcher() {
      if (!fetcher) {
        throw Error('`fetcher` can only be used inside `serverLoader`');
      }

      return fetcher;
    },
  };

  fetcher = init.manifest ? createServerFetcher(event, init.manifest) : null;
  return event;
}

export function createServerFetcher(
  event: ServerRequestEvent,
  manifest: ServerManifest,
): ServerFetcher {
  return (input, init) => {
    const request = coerceFetchInput(input, init, event.request.URL);
    const url = new URL(request.url);

    if (event.request.URL.origin === url.origin) {
      const route = matchRoute(url, manifest.routes.http);

      if (!route) {
        return Promise.resolve(
          handleHttpError(httpError('not found', 404), url, manifest),
        );
      }

      return handleHttpRequest(url, request, route, manifest);
    }

    return fetch(request, init);
  };
}
