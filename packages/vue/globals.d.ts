declare module '*.vue' {
  // eslint-disable-next-line @typescript-eslint/ban-types
  const component: import('vue').DefineComponent<{}, {}, any>;
  export default component;
}

declare module '*.md' {
  const meta: import('@vessel-js/app').MarkdownMeta;
  export { meta };
  // eslint-disable-next-line @typescript-eslint/ban-types
  const component: import('vue').DefineComponent<{}, {}, any>;
  export default component;
}
