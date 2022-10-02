/// <reference types="vite/client" />
/// <reference types="@vessel-js/app/globals" />

declare module '*.svelte' {
  const component: typeof import('svelte').SvelteComponent;
  export default component;
}
