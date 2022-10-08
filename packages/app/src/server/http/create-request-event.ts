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
  type RequestParams,
} from 'shared/http';
import { matchRoute } from 'shared/routing';

import { handleHttpRequest } from './handlers/handle-http-request';

export function createServerRequestEvent<
  Params extends RequestParams = RequestParams,
>(init: ServerRequestEventInit<Params>): ServerRequestEvent<Params> {
  init.request = createVesselRequest(init.request);

  const pageHeaders = init.pageResponse?.headers ?? new Headers();

  const pageCookies =
    init.pageResponse?.cookies ??
    new Cookies({ url: init.url, headers: pageHeaders });

  let fetcher: ServerFetcher | null = null;

  const event: ServerRequestEvent<Params> = {
    get params() {
      return init.params;
    },
    get request() {
      return init.request as ServerRequestEvent<Params>['request'];
    },
    get pageResponse() {
      return {
        headers: pageHeaders,
        cookies: pageCookies,
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
      if (route) {
        return handleHttpRequest(url, request, route, manifest);
      }
    }

    return fetch(request, init);
  };
}
