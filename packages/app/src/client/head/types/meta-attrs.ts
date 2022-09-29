/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Credit: https://github.com/harlan-zw/zhead/blob/main/packages/schema/src/meta.ts
 */

import type { MetaTagFields } from './meta-fields';

export interface MetaTagAttributes<
  T extends keyof MetaTagFields = keyof MetaTagFields,
> {
  /**
   * This attribute declares the document's character encoding.* If the attribute is present,
   * its value must be an ASCII case-insensitive match for the string "utf-8", because UTF-8 is the
   * only valid encoding for HTML5 documents. <meta> elements which declare a character encoding
   * must be located entirely within the first 1024 bytes of the document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-charset
   */
  charset?: string;
  /**
   * This attribute contains the value for the http-equiv or name attribute, depending on which
   * is used.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-content
   */
  content?: MetaTagFields[T];
  /**
   * Defines a pragma directive. The attribute is named http-equiv(alent) because all the allowed
   * values are names of particular HTTP headers.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-http-equiv
   */
  ['http-equiv']?:
    | 'content-security-policy'
    | 'content-type'
    | 'default-style'
    | 'x-ua-compatible'
    | 'refresh'
    | 'accept-ch';
  /**
   * The name and content attributes can be used together to provide document metadata in terms of
   * name-value pairs, with the name attribute giving the metadata name, and the content attribute
   * giving the value.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-name
   */
  name?: T;
  /**
   * The property attribute is used to define a property associated with the content attribute.
   *
   * Mainly used for og and twitter meta tags.
   */
  property?: T;
}
