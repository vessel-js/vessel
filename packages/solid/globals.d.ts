declare module '*.md' {
  const meta: import('@vessel-js/app').MarkdownMeta;
  export { meta };
  // eslint-disable-next-line @typescript-eslint/ban-types
  const component: import('solid-js').ParentComponent;
  export default component;
}
