/**
 * Credit: https://github.com/harlan-zw/zhead/blob/main/packages/schema/src/meta-flat.ts
 */

export interface MetaTagFields {
  /**
   * This attribute declares the document's character encoding. If the attribute is present,
   * its value must be an ASCII case-insensitive match for the string "utf-8", because UTF-8 is
   * the only valid encoding for HTML5 documents. <meta> elements which declare a character
   * encoding must be located entirely within the first 1024 bytes of the document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#attr-charset
   */
  charset: string;
  /**
   * Use this tag to provide a short description of the page. In some situations, this description
   * is used in the snippet shown in search results.
   *
   * @see https://developers.google.com/search/docs/advanced/appearance/snippet#meta-descriptions
   */
  description: string;
  /**
   * Specifies one or more color schemes with which the document is compatible. The browser will
   * use this information in tandem with the user's browser or device settings to determine what
   * colors to use for everything from background and foregrounds to form controls and scrollbars.
   * The primary use for <meta name="color-scheme"> is to indicate compatibility with—and order of
   * preference for—light and dark color modes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name
   */
  'color-scheme': string;
  /**
   * The name of the application running in the web page.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name
   */
  'application-name': string;
  /**
   * The name of the document's author.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name
   */
  author: string;
  /**
   * The name of the creator of the document, such as an organization or institution.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#other_metadata_names
   */
  creator: string;
  /**
   * The name of the document's publisher.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#other_metadata_names
   */
  publisher: string;
  /**
   * The identifier of the software that generated the page.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#standard_metadata_names_defined_in_the_html_specification
   */
  generator: string;
  /**
   * Controls the HTTP Referer header of requests sent from the document.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#standard_metadata_names_defined_in_the_html_specification
   */
  referrer:
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
   * This tag tells the browser how to render a page on a mobile device. Presence of this tag
   * indicates to Google that the page is mobile friendly.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#standard_metadata_names_defined_in_other_specifications
   */
  viewport:
    | string
    | Partial<{
        /**
         * Defines the pixel width of the viewport that you want the web site to be rendered at.
         */
        width: number | string | 'device-width';
        /**
         * Defines the height of the viewport. Not used by any browser.
         */
        height: number | string | 'device-height';
        /**
         * Defines the ratio between the device width
         * (device-width in portrait mode or device-height in landscape mode) and the viewport size.
         *
         * @minimum 0
         * @maximum 10
         */
        'initial-scale': number | string;
        /**
         * Defines the maximum amount to zoom in. It must be greater or equal to the minimum-scale
         * or the behavior is undefined. Browser settings can ignore this rule and iOS10+ ignores
         * it by default.
         *
         * @minimum 0
         * @maximum 10
         */
        'maximum-scale': number | string;
        /**
         * Defines the minimum zoom level. It must be smaller or equal to the maximum-scale or
         * the behavior is undefined. Browser settings can ignore this rule and iOS10+ ignores it
         * by default.
         *
         * @minimum 0
         * @maximum 10
         */
        'minimum-scale': number | string;
        /**
         * If set to no, the user is unable to zoom in the webpage. The default is yes. Browser
         * settings can ignore this rule, and iOS10+ ignores it by default.
         */
        'user-scalable': 'yes' | 'no';
        /**
         * The auto value doesn't affect the initial layout viewport, and the whole web page is
         * viewable. The contain value means that the viewport is scaled to fit the largest
         * rectangle inscribed within the display.
         *
         * The cover value means that the viewport is scaled to fill the device display. It is
         * highly recommended to make use of the safe area inset variables to ensure that important
         * content doesn't end up outside the display.
         */
        'viewport-fit': 'auto' | 'contain' | 'cover';
      }>;
  /**
   * Control the behavior of search engine crawling and indexing.
   */
  robots:
    | string
    | Partial<{
        /**
         * There are no restrictions for indexing or serving. This directive is the default value
         * and has no effect if explicitly listed.
         */
        all: boolean;
        /**
         * Do not show this page, media, or resource in search results. If you don't specify this
         * directive, the page, media, or resource may be indexed and shown in search results.
         */
        noindex: boolean;
        /**
         * Do not follow the links on this page. If you don't specify this directive, Google may
         * use the links on the page to discover those linked pages.
         */
        nofollow: boolean;
        /**
         * Equivalent to noindex, nofollow.
         */
        none: boolean;
        /**
         * Do not show a cached link in search results. If you don't specify this directive, Google
         * may generate a cached page and users may access it through the search results.
         */
        noarchive: boolean;
        /**
         * Do not show a sitelinks search box in the search results for this page. If you don't
         * specify this directive, Google may generate a search box specific to your site in
         * search results, along with other direct links to your site.
         */
        nositelinkssearchbox: boolean;
        /**
         *
         * Do not show a text snippet or video preview in the search results for this page. A
         * static image thumbnail (if available) may still be visible, when it results in a better
         * user experience.
         */
        nosnippet: boolean;
        /**
         * Google is allowed to index the content of a page if it's embedded in another page
         * through iframes or similar HTML tags, in spite of a noindex directive. `indexifembedded`
         * only has an effect if it's accompanied by noindex.
         */
        indexifembedded: boolean;
        /**
         * Use a maximum of [number] characters as a textual snippet for this search result.
         */
        'max-snippet': number | string;
        /**
         * Set the maximum size of an image preview for this page in a search results.
         */
        'max-image-preview': 'none' | 'standard' | 'large';
        /**
         * Use a maximum of [number] seconds as a video snippet for videos on this page in search
         * results.
         */
        'max-video-preview': number | string;
        /**
         * Don't offer translation of this page in search results.
         */
        notranslate: boolean;
        /**
         * Do not show this page in search results after the specified date/time.
         */
        unavailable_after: string;
        /**
         * Do not index images on this page.
         */
        noimageindex: boolean;
      }>;
  google: /**
   * When users search for your site, Google Search results sometimes display a search box specific
   * to your site, along with other direct links to your site. This tag tells Google not to show
   * the sitelinks search box.
   */
  | 'nositelinkssearchbox'
    /**
     * Prevents various Google text-to-speech services from reading aloud web pages using
     * text-to-speech (TTS).
     */
    | 'nopagereadaloud';
  /**
   * When Google recognizes that the contents of a page aren't in the language that the user
   * likely wants to read, Google may provide a translated title link and snippet in search results.
   */
  googlebot: 'notranslate';
  /**
   * You can use this tag on the top-level page of your site to verify ownership for Search Console.
   */
  'google-site-verification': string;
  /**
   * Labels a page as containing adult content, to signal that it be filtered by SafeSearch results.
   *
   * @see https://developers.google.com/search/docs/advanced/guidelines/safesearch
   */
  rating: 'adult';

  // RFDa
  /**
   * The canonical URL for your page.
   *
   * This should be the undecorated URL, without session variables, user identifying parameters,
   * or counters. Likes and Shares for this URL will aggregate at this URL.
   *
   * For example: mobile domain URLs should point to the desktop version of the URL as the
   * canonical URL to aggregate Likes and Shares across different versions of the page.
   */
  'og:url': string;
  /**
   * The title of your page without any branding such as your site name.
   */
  'og:title': string;
  /**
   * A brief description of the content, usually between 2 and 4 sentences.
   */
  'og:description': string;
  /**
   * The type of media of your content. This tag impacts how your content shows up in Feed. If
   * you don't specify a type, the default is website. Each URL should be a single object, so
   * multiple `og:type` values are not possible.
   */
  'og:type':
    | 'website'
    | 'article'
    | 'book'
    | 'profile'
    // Namespace URI https://ogp.me/ns/music#
    | 'music.song'
    | 'music.album'
    | 'music.playlist'
    | 'music.radio_status'
    // Namespace URI https://ogp.me/ns/video#
    | 'video.movie'
    | 'video.episode'
    | 'video.tv_show'
    | 'video.other';
  /**
   * The locale of the resource. Defaults to en_US.
   */
  'og:locale': string;
  /**
   * An array of other locales this page is available in.
   */
  'og:locale:alternate': string;
  /**
   * - The word that appears before this object's title in a sentence.
   * - An enum of (a, an, the, "", auto).
   * - If auto is chosen, the consumer of your data should choose between "a" or "an".
   * - Default is "" (blank).
   */
  'og:determiner': 'a' | 'an' | 'the' | '' | 'auto';
  /**
   * If your object is part of a larger website, the name which should be displayed for the
   * overall site. e.g., "IMDb".
   */
  'og:site:name': string;

  // OpenGraph Video

  /**
   * The URL for the video. If you want the video to play in-line in Feed, you should use the
   * https:// URL if possible.
   */
  'og:video': string;
  /**
   * Equivalent to og:video
   */
  'og:video:url': string;
  /**
   *
   * Secure URL for the video. Include this even if you set the secure URL in og:video.
   */
  'og:video:secure:url': string;
  /**
   * MIME type of the video.
   */
  'og:video:type': 'application/x-shockwave-flash' | 'video/mp4';
  /**
   * Width of video in pixels. This property is required for videos.
   */
  'og:video:width': string | number;
  /**
   * Height of video in pixels. This property is required for videos.
   */
  'og:video:height': string | number;

  // OpenGraph Image

  /**
   * The URL of the image that appears when someone shares the content.
   */
  'og:image': string;
  /**
   * Equivalent to og:image
   */
  'og:image:url': string;
  /**
   *
   * https:// URL for the image
   */
  'og:image:secure:url': string;
  /**
   * MIME type of the image.
   */
  'og:image:type': 'image/jpeg' | 'image/gif' | 'image/png';
  /**
   * Width of image in pixels. Specify height and width for your image to ensure that the image
   * loads properly the first time it's shared.
   */
  'og:image:width': string | number;
  /**
   * Height of image in pixels. Specify height and width for your image to ensure that the image
   * loads properly the first time it's shared.
   */
  'og:image:height': string | number;

  // Twitter meta

  /**
   * Your Facebook app ID.
   *
   * In order to use Facebook Insights you must add the app ID to your page. Insights lets you
   * view analytics for traffic to your site from Facebook. Find the app ID in your App Dashboard.
   */
  'fb:app_id': string | number;
  /**
   * The card type
   *
   * Used with all cards
   *
   * @see https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards
   */
  'twitter:card': 'summary' | 'summary_large_image' | 'app' | 'player';
  /**
   * Title of content (max 70 characters)
   *
   * Used with summary, summary_large_image, player cards
   *
   * Same as `og:title`
   *
   * @maxLength 70
   */
  'twitter:title': string;
  /**
   * Description of content (maximum 200 characters)
   *
   * Used with summary, summary_large_image, player cards.
   *
   * Same as `og:description`
   *
   * @maxLength 200
   */
  'twitter:description': string;
  /**
   * Used with summary, summary_large_image, player cards.
   *
   * - URL of image to use in the card.
   * - Images must be less than 5MB in size.
   * - JPG, PNG, WEBP and GIF formats are supported.
   * - Only the first frame of an animated GIF will be used. SVG is not supported.
   *
   * Same as `og:image`.
   */
  'twitter:image': string;
  /**
   * Used with summary, summary_large_image, player cards.
   *
   * A text description of the image conveying the essential nature of an image to users who are
   * visually impaired. Maximum 420 characters.
   *
   * Same as `og:image:alt`.
   *
   * @maxLength 420
   */
  'twitter:image:alt': string;
  /**
   * Used with summary, summary_large_image, app, player cards.
   *
   * The @username of website. Either twitter:site or twitter:site:id is required.
   *
   * @example @harlan_zw
   */
  'twitter:site': string;
  /**
   * Used with summary, summary_large_image, player cards.
   *
   * Same as twitter:site, but the user’s Twitter ID. Either twitter:site or twitter:site:id is
   * required.
   *
   * @example 1296047337022742529
   */
  'twitter:site:id': string | number;
  /**
   * Used with summary_large_image cards.
   *
   * The @username who created the pages content.
   *
   * @example harlan_zw
   */
  'twitter:creator': string;
  /**
   * Used with summary, summary_large_image cards.
   *
   * Twitter user ID of content creator
   */
  'twitter:creator:id': string | number;
  /**
   * Used with player card.
   *
   * HTTPS URL of player iframe
   */
  'twitter:player': string;
  /**
   * Used with player card.
   *
   * Width of iframe in pixels
   */
  'twitter:player:width': string | number;
  /**
   * Used with player card.
   *
   * Height of iframe in pixels
   */
  'twitter:player:height': string | number;
  /**
   * Used with player card.
   *
   * URL to raw video or audio stream
   */
  'twitter:player:stream': string;
  /**
   * Used with app card.
   *
   * Name of your iPhone app
   */
  'twitter:app:name:iphone': string;
  /**
   * Used with app card.
   *
   * Your app ID in the iTunes App Store
   */
  'twitter:app:id:iphone': string;
  /**
   * Used with app card.
   *
   * Your app’s custom URL scheme (you must include ”://” after your scheme name)
   */
  'twitter:app:url:iphone': string;
  /**
   * Used with app card.
   *
   * Name of your iPad optimized app
   */
  'twitter:app:name:ipad': string;
  /**
   * Used with app card.
   *
   * Your app ID in the iTunes App Store
   */
  'twitter:app:id:ipad': string;
  /**
   * Used with app card.
   *
   * Your app’s custom URL scheme
   */
  'twitter:app:url:ipad': string;
  /**
   * Used with app card.
   *
   * Name of your Android app
   */
  'twitter:app:name:googleplay': string;
  /**
   * Used with app card.
   *
   * Your app ID in the Google Play Store
   */
  'twitter:app:id:googleplay': string;
  /**
   * Your app’s custom URL scheme
   */
  'twitter:app:url:googleplay': string;

  // DEVICES
  /**
   * Indicates a suggested color that user agents should use to customize the display of the page or
   * of the surrounding user interface.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name/theme-color
   */
  'theme-color': string;
  /**
   * Sets whether a web application runs in full-screen mode.
   */
  'mobile-web-app-capable': 'yes';
  /**
   * Sets whether a web application runs in full-screen mode.
   *
   * @see https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html
   */
  'apple-mobile-web-app-capable': 'yes';
  /**
   * Sets the style of the status bar for a web application.
   *
   * @see https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html
   */
  'apple-mobile-web-app-status-bar-style':
    | 'default'
    | 'black'
    | 'black-translucent';
  /**
   * Make the app title different from the page title.
   */
  'apple-mobile-web-app-title': string;
  /**
   * Enables or disables automatic detection of possible phone numbers in a webpage in Safari on iOS.
   *
   * @see https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html
   */
  'format-detection': 'telephone=no';
  /**
   * Tile image for windows.
   */
  'msapplication-tile-image': string;
  /**
   * Tile colour for windows
   */
  'msapplication-tile-color': string;
  /**
   * URL of a config for windows tile.
   */
  'msapplication-config': string;

  // PRAGMA
  'content-security-policy':
    | string
    | Partial<{
        'child-src': string;
        'connect-src': string;
        'default-src': string;
        'font-src': string;
        'img-src': string;
        'manifest-src': string;
        'media-src': string;
        'object-src': string;
        'prefetch-src': string;
        'script-src': string;
        'script-src-elem': string;
        'script-src-attr': string;
        'style-src': string;
        'style-src-elem': string;
        'style-src-attr': string;
        'worker-src': string;
        'base-uri': string;
        sandbox: string;
        'form-action': string;
        'frame-ancestors': string;
        'navigate-to': string;
        'report-uri': string;
        'report-to': string;
        'require-sri-for': string;
        'require-trusted-types-for': string;
        'trusted-types': string;
        'upgrade-insecure-requests': string;
      }>;
  'content-type': 'text/html; charset=utf-8';
  'default-style': string;
  'x-ua-compatible': 'IE=edge';
  refresh:
    | string
    | {
        seconds: number | string;
        url: string;
      };
}
