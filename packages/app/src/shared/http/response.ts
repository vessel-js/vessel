/**
 * Few functions adapted from: https://github.com/remix-run/remix/blob/main/packages/remix-server-runtime
 */

import { isString } from 'shared/utils/unit';

import { Cookies } from './cookies';

export type VesselResponse = Response & Required<VesselResponseInit>;

export type VesselResponseInit = {
  headers?: Headers;
  cookies?: Cookies;
};

const VESSEL_RESPONSE = Symbol();

export function createVesselResponse(
  url: URL,
  response: Response,
  init?: VesselResponseInit,
): VesselResponse {
  if (isVesselResponse(response)) return response;

  response[VESSEL_RESPONSE] = true;

  if (init?.headers) {
    appendResponseHeaders(response, init.headers);
  }

  if (!('cookies' in response)) {
    const cookies =
      init?.cookies ?? new Cookies({ url, headers: response.headers });
    Object.defineProperty(response, 'cookies', {
      enumerable: true,
      get() {
        return cookies;
      },
    });
  }

  return response as VesselResponse;
}

export function appendResponseHeaders(response: Response, headers: Headers) {
  for (const [key, value] of headers) {
    response.headers.append(key, value);
  }
}

export type JSONData = Record<string, unknown>;

export type JSONResponse<T extends JSONData = JSONData> = Response & {
  json(): Promise<T>;
};

/**
 * This is a shortcut for creating `application/json` responses. Converts `data` to JSON and sets
 * the `Content-Type` header.
 */
export function json<Data extends JSONData>(
  data: Data,
  init: number | ResponseInit = {},
): JSONResponse<Data> {
  const responseInit = typeof init === 'number' ? { status: init } : init;
  const headers = new Headers(responseInit.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers,
  });
}

export type RedirectFunction = (
  url: string,
  init?: number | ResponseInit,
) => JSONResponse<never>;

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export function isVesselResponse(value: unknown): value is VesselResponse {
  return value?.[VESSEL_RESPONSE];
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);
export function isRedirectResponse(
  response: unknown,
): response is JSONResponse<never> {
  return isResponse(response) && redirectStatusCodes.has(response.status);
}

/**
 * A redirect response. Sets the status code and the `Location` header. Defaults to "302 Found".
 */
export const redirect: RedirectFunction = (url, init = 302) => {
  let responseInit = init;

  if (typeof responseInit === 'number') {
    responseInit = { status: responseInit };
  } else if (typeof responseInit.status === 'undefined') {
    responseInit.status = 302;
  }

  const headers = new Headers(responseInit.headers);
  headers.set('Location', url);

  return new Response(null, {
    ...responseInit,
    headers,
  }) as JSONResponse<never>;
};

/**
 * A redirect response that's intended to be handled client-side without triggering a page reload.
 * Defaults to "302 Found".
 */
export const clientRedirect: RedirectFunction = (url, init = 302) => {
  const response = redirect(url, init);
  response.headers.set('X-Vessel-Redirect', response.headers.get('Location')!);
  response.headers.delete('Location');
  return response;
};

export function isClientRedirectResponse(
  response: unknown,
): response is JSONResponse<never> {
  return isResponse(response) && response.headers.has('X-Vessel-Redirect');
}

export async function resolveResponseData<Data = unknown>(
  response: Response,
): Promise<Data> {
  const contentType = response.headers.get('Content-Type');
  return contentType && /\bapplication\/json\b/.test(contentType)
    ? response.json()
    : response.text();
}

export type AnyResponse<Data extends JSONData = JSONData> =
  | string
  | Data
  | Response
  | JSONResponse<Data>;

export function coerceAnyResponse(response: AnyResponse): Response {
  return isResponse(response)
    ? response
    : isString(response)
    ? new Response(response)
    : json(response ?? {});
}
