/**
 * Cookie implementation from: https://github.com/jshttp/cookie
 */

const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

export class Cookie {
  constructor(public name: string, public value: string, public options: CookieSerializeOptions) {}

  static parse(value: string, options: CookieParseOptions = {}): Record<string, string> {
    if (typeof value !== 'string') {
      throw new TypeError('argument str must be a string');
    }

    const obj = {};
    const decode = options.decode || decoder;

    let index = 0;
    while (index < value.length) {
      const eqIdx = value.indexOf('=', index);

      // no more cookie pairs
      if (eqIdx === -1) {
        break;
      }

      let endIdx = value.indexOf(';', index);

      if (endIdx === -1) {
        endIdx = value.length;
      } else if (endIdx < eqIdx) {
        // backtrack on prior semicolon
        index = value.lastIndexOf(';', eqIdx - 1) + 1;
        continue;
      }

      const key = value.slice(index, eqIdx).trim();

      if (undefined === obj[key]) {
        let val = value.slice(eqIdx + 1, endIdx).trim();
        if (val.charCodeAt(0) === 0x22) val = val.slice(1, -1);
        obj[key] = tryDecode(val, decode);
      }

      index = endIdx + 1;
    }

    return obj;
  }

  static serialize(name: string, value: string, options: CookieSerializeOptions = {}): string {
    const encode = options.encode || encodeURIComponent;

    if (typeof encode !== 'function') {
      throw new TypeError('option encode is invalid');
    }

    if (!fieldContentRegExp.test(name)) {
      throw new TypeError('argument name is invalid');
    }

    const val = encode(value);

    if (val && !fieldContentRegExp.test(val)) {
      throw new TypeError('argument val is invalid');
    }

    let str = name + '=' + val;

    if (null != options.maxAge) {
      const maxAge = options.maxAge - 0;

      if (isNaN(maxAge) || !isFinite(maxAge)) {
        throw new TypeError('option maxAge is invalid');
      }

      str += '; Max-Age=' + Math.floor(maxAge);
    }

    if (options.domain) {
      if (!fieldContentRegExp.test(options.domain)) {
        throw new TypeError('option domain is invalid');
      }

      str += '; Domain=' + options.domain;
    }

    if (options.path) {
      if (!fieldContentRegExp.test(options.path)) {
        throw new TypeError('option path is invalid');
      }

      str += '; Path=' + options.path;
    }

    if (options.expires) {
      const expires = options.expires;

      if (!isDate(expires) || isNaN(expires.valueOf())) {
        throw new TypeError('option expires is invalid');
      }

      str += '; Expires=' + expires.toUTCString();
    }

    if (options.httpOnly) {
      str += '; HttpOnly';
    }

    if (options.secure) {
      str += '; Secure';
    }

    if (options.priority) {
      const priority =
        typeof options.priority === 'string' ? options.priority.toLowerCase() : options.priority;

      switch (priority) {
        case 'low':
          str += '; Priority=Low';
          break;
        case 'medium':
          str += '; Priority=Medium';
          break;
        case 'high':
          str += '; Priority=High';
          break;
        default:
          throw new TypeError('option priority is invalid');
      }
    }

    if (options.sameSite) {
      const sameSite =
        typeof options.sameSite === 'string' ? options.sameSite.toLowerCase() : options.sameSite;

      switch (sameSite) {
        case true:
          str += '; SameSite=Strict';
          break;
        case 'lax':
          str += '; SameSite=Lax';
          break;
        case 'strict':
          str += '; SameSite=Strict';
          break;
        case 'none':
          str += '; SameSite=None';
          break;
        default:
          throw new TypeError('option sameSite is invalid');
      }
    }

    return str;
  }
}

const __toString = Object.prototype.toString;
function isDate(val) {
  return __toString.call(val) === '[object Date]' || val instanceof Date;
}

function decoder(value: string) {
  return value.indexOf('%') !== -1 ? decodeURIComponent(value) : value;
}

function tryDecode(value: string, decode: (value: string) => string): string {
  try {
    return decode(value);
  } catch (e) {
    return value;
  }
}

export interface CookieSerializeOptions {
  /**
   * Specifies the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.3|Domain Set-Cookie attribute}. By default, no
   * domain is set, and most clients will consider the cookie to apply to only
   * the current domain.
   */
  domain?: string | undefined;

  /**
   * Specifies a function that will be used to encode a cookie's value. Since
   * value of a cookie has a limited character set (and must be a simple
   * string), this function can be used to encode a value into a string suited
   * for a cookie's value.
   *
   * The default function is the global `encodeURIComponent`, which will
   * encode a JavaScript string into UTF-8 byte sequences and then URL-encode
   * any that fall outside of the cookie range.
   */
  encode?(value: string): string;

  /**
   * Specifies the `Date` object to be the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.1|`Expires` `Set-Cookie` attribute}. By default,
   * no expiration is set, and most clients will consider this a "non-persistent cookie" and will delete
   * it on a condition like exiting a web browser application.
   *
   * *Note* the {@link https://tools.ietf.org/html/rfc6265#section-5.3|cookie storage model specification}
   * states that if both `expires` and `maxAge` are set, then `maxAge` takes precedence, but it is
   * possible not all clients by obey this, so if both are set, they should
   * point to the same date and time.
   */
  expires?: Date | undefined;
  /**
   * Specifies the boolean value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.6|`HttpOnly` `Set-Cookie` attribute}.
   * When truthy, the `HttpOnly` attribute is set, otherwise it is not. By
   * default, the `HttpOnly` attribute is not set.
   *
   * *Note* be careful when setting this to true, as compliant clients will
   * not allow client-side JavaScript to see the cookie in `document.cookie`.
   */
  httpOnly?: boolean | undefined;
  /**
   * Specifies the number (in seconds) to be the value for the `Max-Age`
   * `Set-Cookie` attribute. The given number will be converted to an integer
   * by rounding down. By default, no maximum age is set.
   *
   * *Note* the {@link https://tools.ietf.org/html/rfc6265#section-5.3|cookie storage model specification}
   * states that if both `expires` and `maxAge` are set, then `maxAge` takes precedence, but it is
   * possible not all clients by obey this, so if both are set, they should
   * point to the same date and time.
   */
  maxAge?: number | undefined;
  /**
   * Specifies the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.4|`Path` `Set-Cookie` attribute}.
   * By default, the path is considered the "default path".
   */
  path?: string | undefined;
  /**
   * Specifies the `string` to be the value for the [`Priority` `Set-Cookie` attribute][rfc-west-cookie-priority-00-4.1].
   *
   * - `'low'` will set the `Priority` attribute to `Low`.
   * - `'medium'` will set the `Priority` attribute to `Medium`, the default priority when not set.
   * - `'high'` will set the `Priority` attribute to `High`.
   *
   * More information about the different priority levels can be found in
   * [the specification][rfc-west-cookie-priority-00-4.1].
   *
   * **note** This is an attribute that has not yet been fully standardized, and may change in the future.
   * This also means many clients may ignore this attribute until they understand it.
   */
  priority?: 'low' | 'medium' | 'high' | undefined;
  /**
   * Specifies the boolean or string to be the value for the {@link https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7|`SameSite` `Set-Cookie` attribute}.
   *
   * - `true` will set the `SameSite` attribute to `Strict` for strict same
   * site enforcement.
   * - `false` will not set the `SameSite` attribute.
   * - `'lax'` will set the `SameSite` attribute to Lax for lax same site
   * enforcement.
   * - `'strict'` will set the `SameSite` attribute to Strict for strict same
   * site enforcement.
   *  - `'none'` will set the SameSite attribute to None for an explicit
   *  cross-site cookie.
   *
   * More information about the different enforcement levels can be found in {@link https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7|the specification}.
   *
   * *note* This is an attribute that has not yet been fully standardized, and may change in the future. This also means many clients may ignore this attribute until they understand it.
   */
  sameSite?: true | false | 'lax' | 'strict' | 'none' | undefined;
  /**
   * Specifies the boolean value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.5|`Secure` `Set-Cookie` attribute}. When truthy, the
   * `Secure` attribute is set, otherwise it is not. By default, the `Secure` attribute is not set.
   *
   * *Note* be careful when setting this to `true`, as compliant clients will
   * not send the cookie back to the server in the future if the browser does
   * not have an HTTPS connection.
   */
  secure?: boolean | undefined;
}

export interface CookieParseOptions {
  /**
   * Specifies a function that will be used to decode a cookie's value. Since
   * the value of a cookie has a limited character set (and must be a simple
   * string), this function can be used to decode a previously-encoded cookie
   * value into a JavaScript string or other object.
   *
   * The default function is the global `decodeURIComponent`, which will decode
   * any URL-encoded sequences into their byte representations.
   *
   * *Note* if an error is thrown from this function, the original, non-decoded
   * cookie value will be returned as the cookie's value.
   */
  decode?(value: string): string;
}
