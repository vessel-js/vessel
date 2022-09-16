declare module '*.svelte' {
  const component: typeof import('svelte').SvelteComponent;
  export default component;
}

declare module '*.md' {
  const __markdownMeta: import('@vessel-js/app').MarkdownMeta;
  export { __markdownMeta };
  const component: typeof import('svelte').SvelteComponent;
  export default component;
}
