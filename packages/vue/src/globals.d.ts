/// <reference types="vite/client" />
/// <reference types="@vessel-js/app/globals" />

declare module '*.vue' {
  // eslint-disable-next-line @typescript-eslint/ban-types
  const component: import('vue').DefineComponent<{}, {}, any>;
  export default component;
}
