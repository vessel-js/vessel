/* eslint-disable @typescript-eslint/no-empty-interface */
/// <reference types="vite/client" />
/// <reference types="urlpattern-polyfill" />

declare global {
  interface Window {
    __VSL_TRAILING_SLASH__?: boolean;
    __VSL_STATIC_DATA__: Record<string, string>;
    __VSL_STATIC_DATA_HASH_MAP__: Record<string, string>;
    __VSL_STATIC_REDIRECTS_MAP__: Record<string, string>;
  }

  interface VesselRoutes {}
}

export {};
