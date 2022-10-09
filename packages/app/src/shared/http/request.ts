import { Cookies } from './cookies';

export type VesselRequest = Request & Required<VesselRequestInit>;

export type VesselRequestInit = {
  URL?: URL;
  cookies?: Cookies;
};

export type RequestParams = {
  [param: string]: string | undefined;
};

export type RequestEventInit<Params extends RequestParams = RequestParams> = {
  request: Request & VesselRequestInit;
  params: Params;
};

export type RequestEvent<Params extends RequestParams = RequestParams> = {
  request: VesselRequest;
  params: Params;
};

export function createVesselRequest(
  request: Request & VesselRequestInit,
  init?: VesselRequestInit,
): VesselRequest {
  if (!('URL' in request)) {
    const url = init?.URL ?? new URL(request.url);

    Object.defineProperty(request, 'URL', {
      enumerable: true,
      get() {
        return url;
      },
    });
  }

  if (!('cookies' in request)) {
    const cookies =
      init?.cookies ??
      new Cookies({ url: request.URL!, headers: request.headers });

    Object.defineProperty(request, 'cookies', {
      enumerable: true,
      get() {
        return cookies;
      },
    });
  }

  return request as VesselRequest;
}
