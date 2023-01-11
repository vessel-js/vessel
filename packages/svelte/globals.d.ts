declare module '*.svelte' {
  const component: typeof import('svelte').SvelteComponent;
  export default component;
}

declare module '*.md' {
  const meta: import('@vessel-js/app').MarkdownMeta;
  export { meta };
  const component: typeof import('svelte').SvelteComponent;
  export default component;
}
