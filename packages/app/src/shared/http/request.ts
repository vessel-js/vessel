import { Cookies } from './cookies';

export type VesselRequest = Request & {
  URL: URL;
  cookies: Cookies;
};

export type RequestParams = {
  [param: string]: string | undefined;
};

const VESSEL_REQUEST = Symbol('VESSEL_REQUEST');

export function createVesselRequest(
  request: Request & { URL?: URL; cookies?: Cookies },
): VesselRequest {
  if (isVesselRequest(request)) return request;

  request[VESSEL_REQUEST] = true;

  if (!request.URL) {
    const url = new URL(request.url);
    Object.defineProperty(request, 'URL', {
      enumerable: true,
      get() {
        return url;
      },
    });
  }

  if (!request.cookies) {
    const cookies = new Cookies({
      url: request.URL!,
      headers: request.headers,
    });
    Object.defineProperty(request, 'cookies', {
      enumerable: true,
      get() {
        return cookies;
      },
    });
  }

  return request as VesselRequest;
}

export function isVesselRequest(value: unknown): value is VesselRequest {
  return !!value?.[VESSEL_REQUEST];
}
