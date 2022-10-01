/**
 * Credit:
 * - https://github.com/vueuse/head/blob/main/src/types.ts
 * - https://github.com/harlan-zw/zhead/blob/main/packages/schema/src/head.ts
 */

import type { BaseTagAttributes } from './base-attrs';
import type { BodyTagAttributes } from './body-attrs';
import type { ReactiveAttrs, ReactiveAttrValue } from './head-attrs';
import type { HtmlTagAttributes } from './html-attrs';
import type { LinkTagAttributes } from './link-attrs';
import type { MetaTagAttributes } from './meta-attrs';
import type { NoscriptTagAttributes } from './noscript-attrs';
import type { ScriptTagAttributes } from './script-attrs';
import type { StyleTagAttributes } from './style-attrs';

export type HeadConfigKeys = keyof Omit<HeadConfig, 'titleTemplate'>;

export interface HeadConfig {
  /**
   * The <title> HTML element defines the document's title that is shown in a browser's title bar or a page's tab.
   * It only contains text; tags within the element are ignored.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title
   */
  title?: ReactiveAttrValue<string>;
  /**
   * Generate the title from a template.
   */
  titleTemplate?:
    | ReactiveAttrValue<string>
    | ((title?: string | null) => string);
  /**
   * The <base> HTML element specifies the base URL to use for all relative URLs in a document.
   * There can be only one <base> element in a document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/base
   */
  base?: ReactiveAttrs<BaseTagAttributes>;
  /**
   * The <link> HTML element specifies relationships between the current document and an external
   * resource. This element is most commonly used to link to stylesheets, but is also used to
   * establish site icons (both "favicon" style icons and icons for the home screen and apps on
   * mobile devices) among other things.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-as
   */
  link?: (ReactiveAttrs<LinkTagAttributes> &
    HeadTagRenderPriority &
    HeadTagRenderLocation)[];
  /**
   * The <meta> element represents metadata that cannot be expressed in other HTML elements, like
   * <link> or <script>.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
   */
  meta?: (ReactiveAttrs<MetaTagAttributes> &
    HeadTagRenderPriority &
    HeadTagRenderDuplicate)[];
  /**
   * The <style> HTML element contains style information for a document, or part of a document. It
   * contains CSS, which is applied to the contents of the document containing the <style> element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style
   */
  style?: (ReactiveAttrs<StyleTagAttributes> &
    HeadTagRenderPriority &
    HeadTagInnerContent &
    HeadTagRenderLocation)[];
  /**
   * The <script> HTML element is used to embed executable code or data; this is typically used
   * to embed or refer to JavaScript code.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
   */
  script?: (ReactiveAttrs<ScriptTagAttributes> &
    HeadTagRenderPriority &
    HeadTagRenderDuplicate &
    HeadTagInnerContent &
    HeadTagRenderLocation)[];
  /**
   * The <noscript> HTML element defines a section of HTML to be inserted if a script type on the
   * page is unsupported or if scripting is currently turned off in the browser.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/noscript
   */
  noscript?: (ReactiveAttrs<NoscriptTagAttributes> &
    HeadTagRenderPriority &
    HeadTagInnerContent &
    HeadTagRenderLocation)[];
  /**
   * Attributes for the <html> HTML element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/html
   */
  htmlAttrs?: ReactiveAttrs<HtmlTagAttributes>;
  /**
   * Attributes for the <body> HTML element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/body
   */
  bodyAttrs?: ReactiveAttrs<BodyTagAttributes>;
}

export type HeadTagRenderDuplicate = {
  /**
   * By default, tags which share the same unique key `name, `property` are de-duped. To allow
   * duplicates to be made you can provide a unique key for each entry.
   */
  key?: string;
};

export type HeadTagRenderLocation = {
  /**
   * Render tag at the end of the <body>.
   */
  body?: boolean;
};

export type HeadTagInnerContent = {
  /**
   * Sets the textContent of an element.
   */
  children?: string | null;
};

export type HeadTagRenderPriority = {
  /**
   * The priority for rendering the tag, without this all tags are rendered as they are registered
   * (besides some special tags).
   *
   * The following special tags have default priorities:
   * * -2 <meta charset ...>
   * * -1 <base>
   * * 0 <meta http-equiv="content-security-policy" ...>
   *
   * All other tags have a default priority of 10: <meta>, <script>, <link>, <style>, etc
   *
   * @warn Experimental feature. Only available when rendering SSR
   */
  renderPriority?: number;
};
