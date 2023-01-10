/**
 * Copied and slightly adapted from SvelteKit: https://github.com/sveltejs/kit
 */

import { Cookie, type CookieParseOptions, type CookieSerializeOptions } from './cookie';

const DEFAULT_SERIALIZE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
} as const;

export interface CookiesInit {
  url: URL;
  headers?: Headers;
}

export class Cookies implements Iterable<[string, Cookie]> {
  protected _cookies = new Map<string, Cookie>();

  constructor(protected readonly init: CookiesInit) {}

  get(name: string, options?: CookieParseOptions) {
    const cookie = this._cookies.get(name);

    if (
      cookie &&
      domainMatches(this.init.url.hostname, cookie.options.domain) &&
      pathMatches(this.init.url.pathname, cookie.options.path)
    ) {
      return cookie.value;
    }

    const headers = this.init.headers;
    if (headers) {
      const decode = options?.decode || decodeURIComponent;
      const cookie = Cookie.parse(headers.get('cookie') ?? '', { decode });
      return cookie[name];
    }

    return undefined;
  }

  set(name: string, value: string, options?: CookieSerializeOptions) {
    this._cookies.set(
      name,
      new Cookie(name, value, {
        ...DEFAULT_SERIALIZE_OPTIONS,
        ...options,
      }),
    );
  }

  delete(name: string) {
    this._cookies.delete(name);
  }

  clear() {
    this._cookies.clear();
  }

  attach(body: Request | Response) {
    for (const newCookie of this._cookies.values()) {
      const { name, value, options } = newCookie;
      body.headers.append('set-cookie', Cookie.serialize(name, value, options));
    }
  }

  [Symbol.iterator]() {
    return this._cookies[Symbol.iterator]();
  }
}

function domainMatches(hostname: string, constraint?: string) {
  if (!constraint) return true;

  const normalized = constraint[0] === '.' ? constraint.slice(1) : constraint;

  if (hostname === normalized) return true;
  return hostname.endsWith('.' + normalized);
}

function pathMatches(path: string, constraint?: string) {
  if (!constraint) return true;

  const normalized = constraint.endsWith('/') ? constraint.slice(0, -1) : constraint;

  if (path === normalized) return true;
  return path.startsWith(normalized + '/');
}
