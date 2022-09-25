import type { ServerFetcher, ServerManifest } from 'server/types';
import { matchRoute } from 'shared/routing';

import { Cookies } from './cookies';
import { error, handleHttpError } from './errors';
import { handleHttpRequest } from './handle-http';

export function createRequestEvent<T extends RequestParams = RequestParams>(
  init: RequestEventInit<T>,
): RequestEvent<T> {
  const headers = init.headers ?? new Headers();
  const cookies = init.cookies ?? new Cookies({ url: init.url });

  const requestCookies = new Cookies(init);
  Object.defineProperty(init.request, 'cookies', {
    enumerable: true,
    get() {
      return requestCookies;
    },
  });

  let fetcher: ServerFetcher | null = null;

  const event: RequestEvent<T> = {
    get url() {
      return init.url;
    },
    get params() {
      return init.params;
    },
    get request() {
      return init.request as Request & { cookies: Cookies };
    },
    get headers() {
      return headers;
    },
    get cookies() {
      return cookies;
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

export type RequestParams = {
  [param: string]: string | undefined;
};

export type RequestEventInit<T extends RequestParams> = {
  request: Request;
  url: URL;
  params: T;
  headers?: Headers;
  cookies?: Cookies;
  manifest?: ServerManifest;
};

export interface RequestEvent<Params extends RequestParams = RequestParams> {
  url: URL;
  params: Params;
  request: Request & { cookies: Pick<Cookies, 'get' | 'serialize'> };
  headers: Headers;
  cookies: Cookies;
  fetcher: ServerFetcher;
}

export interface RequestHandler<Params extends RequestParams = RequestParams> {
  (event: RequestEvent<Params>): Response | Promise<Response>;
}

export type HttpRequestModule = {
  [httpMethod: string]: RequestHandler | undefined;
};

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export const HTTP_METHODS: Set<string> = new Set([
  'ANY',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

export const ALL_HTTP_METHODS = Array.from(HTTP_METHODS);

export function getAllowedMethods(mod: HttpRequestModule) {
  const allowed: string[] = [];

  for (const method of HTTP_METHODS) {
    if (method in mod) allowed.push(method);
  }

  if (mod.GET || mod.HEAD) allowed.push('HEAD');

  return allowed;
}

function createServerFetcher(
  event: RequestEvent,
  manifest: ServerManifest,
): ServerFetcher {
  return (input, init) => {
    const request = coerceFetchInput(input, init, event.url);
    const url = new URL(request.url);

    if (event.url.origin === url.origin) {
      const route = matchRoute(url, manifest.routes.http);

      if (!route) {
        return Promise.resolve(
          handleHttpError(error('not found', 404), manifest.dev),
        );
      }

      return handleHttpRequest(url, request, route, manifest);
    }

    return fetch(request, init);
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
