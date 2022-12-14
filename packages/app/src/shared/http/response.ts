/**
 * Few functions adapted from: https://github.com/remix-run/remix/blob/main/packages/remix-server-runtime
 */

import { isString } from 'shared/utils/unit';

import { Cookies } from './cookies';

export interface VesselResponse extends Response {
  cookies: Cookies;
}

export interface VesselJSONResponse<T extends JSONData = JSONData>
  extends Omit<VesselResponse, 'json'> {
  json(): Promise<T>;
}

const VESSEL_RESPONSE = Symbol('VESSEL_RESPONSE');

export function createVesselResponse(
  url: URL,
  response: Response & { cookies?: Cookies },
): VesselResponse {
  if (isVesselResponse(response)) return response;

  response[VESSEL_RESPONSE] = true;

  if (!response.cookies) {
    const cookies = new Cookies({ url, headers: response.headers });
    Object.defineProperty(response, 'cookies', {
      enumerable: true,
      get() {
        return cookies;
      },
    });
  }

  return response as VesselResponse;
}

export function appendHeaders(body: Request | Response, headers: Headers) {
  for (const [key, value] of headers) {
    body.headers.append(key, value);
  }
}

export interface JSONData extends Record<string, any> {}

export interface JSONResponse<T extends JSONData = JSONData> extends Omit<Response, 'json'> {
  json(): Promise<T>;
}

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

export interface RedirectFunction {
  (url: string, init?: number | ResponseInit): JSONResponse<never>;
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export function isVesselResponse(value: unknown): value is VesselResponse {
  return !!value?.[VESSEL_RESPONSE];
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);
export function isRedirectResponse(response: unknown): response is JSONResponse<never> {
  return isResponse(response) && redirectStatusCodes.has(response.status);
}

export function resolveResponseRedirect(response: Response): string | null {
  return response.headers.get('X-Vessel-Redirect');
}

/**
 * A redirect response. Sets the status code and the `Location` header. Defaults to `307` -
 * "Temporary Redirect".
 */
export const redirect: RedirectFunction = (url, init = 307) => {
  let responseInit = init;

  if (typeof responseInit === 'number') {
    responseInit = { status: responseInit };
  } else if (typeof responseInit.status === 'undefined') {
    responseInit.status = 307;
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
 * Defaults to `307` - "Temporary Redirect".
 */
export const clientRedirect: RedirectFunction = (url, init = 307) => {
  const response = redirect(url, init);
  response.headers.set('X-Vessel-Redirect', response.headers.get('Location')!);
  response.headers.delete('Location');
  return response;
};

export function isClientRedirectResponse(response: unknown): response is JSONResponse<never> {
  return isResponse(response) && response.headers.has('X-Vessel-Redirect');
}

export async function resolveResponseData<Data = unknown>(response: Response): Promise<Data> {
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

export type InferAnyResponseData<T> = T extends Response
  ? T extends JSONResponse<infer Data>
    ? Data
    : any
  : T;

export function coerceAnyResponse(url: URL, response: AnyResponse): VesselResponse {
  return createVesselResponse(
    url,
    isResponse(response)
      ? response
      : isString(response)
      ? new Response(response)
      : json(response ?? {}),
  );
}

export interface ResponseDetails {
  headers: Headers;
  cookies: Cookies;
}

export function createResponseDetails(url: URL, init?: Partial<ResponseDetails>): ResponseDetails {
  const headers = init?.headers ?? new Headers();
  const cookies = init?.cookies ?? new Cookies({ url, headers });
  return { headers, cookies };
}
