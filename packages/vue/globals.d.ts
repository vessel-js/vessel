declare module '*.vue' {
  // eslint-disable-next-line @typescript-eslint/ban-types
  const component: import('vue').DefineComponent<{}, {}, any>;
  export default component;
}

declare module '*.md' {
  const __markdownMeta: import('@vessel-js/app').MarkdownMeta;
  export { __markdownMeta };
  // eslint-disable-next-line @typescript-eslint/ban-types
  const component: import('vue').DefineComponent<{}, {}, any>;
  export default component;
}
