/// <reference types="vite/client" />

declare module '*.vue' {
  // eslint-disable-next-line @typescript-eslint/ban-types
  const component: import('vue').DefineComponent<{}, {}, any>;
  export default component;
}
