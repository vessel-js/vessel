import { Cookies } from './cookies';

export type RequestParams = {
  [param: string]: string | undefined;
};

export type VesselRequest = Request & VesselRequestMetadata;

export type VesselRequestMetadata = {
  URL: URL;
  cookies: Pick<Cookies, 'get' | 'attach'>;
};

export function createVesselRequest(
  request: Request & Partial<VesselRequestMetadata>,
  init?: Partial<VesselRequestMetadata>,
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
      new Cookies({
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
