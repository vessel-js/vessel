/**
 * Credit: https://github.com/harlan-zw/zhead/blob/main/packages/schema/src/link.ts
 */

export interface LinkTagAttributes {
  /**
   * This attribute is only used when rel="preload" or rel="prefetch" has been set on the <link>
   * element. It specifies the type of content being loaded by the <link>, which is necessary for
   * request matching, application of correct content security policy, and setting of correct
   * Accept request header. Furthermore, rel="preload" uses this as a signal for request
   * prioritization.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-as
   */
  as?:
    | 'audio'
    | 'document'
    | 'embed'
    | 'fetch'
    | 'font'
    | 'image'
    | 'object'
    | 'script'
    | 'style'
    | 'track'
    | 'video'
    | 'worker';

  /**
   * This enumerated attribute indicates whether CORS must be used when fetching the resource.
   * CORS-enabled images can be reused in the <canvas> element without being tainted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-crossorigin
   */
  crossorigin?: '' | 'anonymous' | 'use-credentials';
  /**
   * Provides a hint of the relative priority to use when fetching a preloaded resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-fetchpriority
   */
  fetchpriority?: 'high' | 'low' | 'auto';
  /**
   * This attribute specifies the URL of the linked resource. A URL can be absolute or relative.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-href
   */
  href?: string;
  /**
   * This attribute indicates the language of the linked resource. It is purely advisory.
   * Allowed values are specified by RFC 5646: Tags for Identifying Languages (also known as BCP 47).
   * Use this attribute only if the href attribute is present.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-hreflang
   */
  hreflang?: string;
  /**
   * For rel="preload" and as="image" only, the imagesizes attribute is a sizes attribute that
   * indicates to preload the appropriate resource used by an img element with corresponding
   * values for its srcset and sizes attributes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-imagesizes
   */
  imagesizes?: string;
  /**
   * For rel="preload" and as="image" only, the imagesrcset attribute is a sourceset attribute that
   * indicates to preload the appropriate resource used by an img element with corresponding
   * values for its srcset and sizes attributes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-imagesrcset
   */
  imagesrcset?: string;
  /**
   * Contains inline metadata — a base64-encoded cryptographic hash of the resource (file)
   * you're telling the browser to fetch. The browser can use this to verify that the fetched
   * resource has been delivered free of unexpected manipulation.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-integrity
   */
  integrity?: string;
  /**
   * This attribute specifies the media that the linked resource applies to. Its value must be a
   * media type / media query. This attribute is mainly useful when linking to external
   * stylesheets — it allows the user agent to pick the best adapted one for the device it runs on.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-integrity
   */
  media?: string;
  /**
   * Identifies a resource that might be required by the next navigation and that the user agent
   * should retrieve it. This allows the user agent to respond faster when the resource is
   * requested in the future.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-prefetch
   */
  prefetch?: string;
  /**
   * A string indicating which referrer to use when fetching the resource.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-referrerpolicy
   */
  referrerpolicy?:
    | ''
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';
  /**
   * This attribute names a relationship of the linked document to the current document.
   * The attribute must be a space-separated list of link type values.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-rel
   */
  rel?:
    | 'alternate'
    | 'author'
    | 'shortcut icon'
    | 'bookmark'
    | 'canonical'
    | 'dns-prefetch'
    | 'external'
    | 'help'
    | 'icon'
    | 'license'
    | 'manifest'
    | 'me'
    | 'modulepreload'
    | 'next'
    | 'nofollow'
    | 'noopener'
    | 'noreferrer'
    | 'opener'
    | 'pingback'
    | 'preconnect'
    | 'prefetch'
    | 'preload'
    | 'prerender'
    | 'prev'
    | 'search'
    | 'shortlink'
    | 'stylesheet'
    | 'tag'
    | 'apple-touch-icon'
    | 'apple-touch-startup-image'
    | string;
  /**
   * This attribute defines the sizes of the icons for visual media contained in the resource.
   * It must be present only if the rel contains a value of icon or a non-standard type
   * such as Apple's apple-touch-icon.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-sizes
   */
  sizes?: string;
  /**
   * The title attribute has special semantics on the <link> element.
   * When used on a <link rel="stylesheet"> it defines a default or an alternate stylesheet.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-title
   */
  title?: string;
  /**
   * This attribute is used to define the type of the content linked to.
   *
   * The value of the attribute should be a MIME type such as text/html, text/css, and so on. The
   * common use of this attribute is to define the type of stylesheet being referenced (such as
   * text/css), but given that CSS is the only stylesheet language used on the web, not only is it
   * possible to omit the type attribute, but is actually now recommended practice. It is also
   * used on rel="preload" link types, to make sure the browser only downloads file types that it
   * supports.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link#attr-type
   */
  type?: string;
}
