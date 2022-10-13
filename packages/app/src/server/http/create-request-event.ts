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
  type VesselResponseInit,
} from 'shared/http';
import { matchRoute } from 'shared/routing';
import { isFunction } from 'shared/utils/unit';

import { handleApiRequest } from './handlers/handle-api-request';

export function createPageRequestEvent<
  Params extends RequestParams = RequestParams,
>(init: ServerPageRequestEventInit<Params>): ServerPageRequestEvent<Params> {
  const apiEvent = createApiRequestEvent(init);
  const response = createPageResponse(apiEvent.request.URL, init.response);
  return {
    ...apiEvent,
    get response() {
      return response;
    },
  };
}

export function createApiRequestEvent<
  Params extends RequestParams = RequestParams,
>(init: ServerApiRequestEventInit<Params>): ServerApiRequestEvent<Params> {
  const request = createVesselRequest(init.request);
  const page = init.page
    ? createPageResponse(request.URL, init.page)
    : undefined;
  const serverFetch = createServerFetch(request.URL, init.manifest);

  const event: ServerApiRequestEvent<Params> = {
    get params() {
      return init.params;
    },
    get request() {
      return request;
    },
    get page() {
      return page;
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
    if (isFunction(input) && !input.rpc) {
      throw Error('[vessel] server fetch RPC call was not transformed');
    }

    const request = coerceFetchInput(
      isFunction(input) ? input.rpc! : input,
      init,
      baseURL,
    );

    const requestURL = new URL(request.url);

    if (init?.params) {
      for (const key of Object.keys(init.params)) {
        requestURL.searchParams.append(
          'rpc_params',
          `${key}=${init.params[key]}`,
        );
      }
    }

    if (requestURL.origin === baseURL.origin) {
      const route = matchRoute(requestURL, manifest.routes.api);
      if (route) {
        return createVesselResponse(
          requestURL,
          await handleApiRequest(requestURL, request, route, manifest),
        ) as any;
      }
    }

    return createVesselResponse(requestURL, await fetch(request, init));
  };
}

function createPageResponse(url: URL, response?: VesselResponseInit) {
  const headers = response?.headers ?? new Headers();
  const cookies = response?.cookies ?? new Cookies({ url, headers });
  return { headers, cookies };
}
