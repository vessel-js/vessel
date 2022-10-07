declare module '*.md' {
  const __markdownMeta: import('@vessel-js/app').MarkdownMeta;
  export { __markdownMeta };
  // eslint-disable-next-line @typescript-eslint/ban-types
  const component: import('solid-js').ParentComponent;
  export default component;
}
