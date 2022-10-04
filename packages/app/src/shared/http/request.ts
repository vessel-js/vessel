import { Cookies } from './cookies';

export type VesselRequest = Request & VesselRequestMetadata;

export type VesselRequestMetadata = {
  URL: URL;
  cookies: Pick<Cookies, 'get' | 'serialize'>;
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

export type RequestParams = {
  [param: string]: string | undefined;
};

export type RequestHandler = (request: Request) => Response | Promise<Response>;

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

export function getAllowedMethods(mod: Record<string, unknown>) {
  const allowed: string[] = [];

  for (const method of HTTP_METHODS) {
    if (method in mod) allowed.push(method);
  }

  if (mod.GET || mod.HEAD) allowed.push('HEAD');

  return allowed;
}
