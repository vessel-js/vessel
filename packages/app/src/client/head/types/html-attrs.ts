/**
 * Credit: https://github.com/harlan-zw/zhead/blob/main/packages/schema/src/html-attributes.ts
 */

export interface HtmlTagAttributes {
  /**
   * The lang global attribute helps define the language of an element: the language that
   * non-editable elements are written in, or the language that the editable elements should be
   * written in by the user.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang
   */
  lang?: string;
  /**
   * The dir global attribute is an enumerated attribute that indicates the directionality of the
   * element's text.
   */
  dir?: 'ltr' | 'rtl' | 'auto';
}
