declare module ':virtual/vessel/svelte/app' {
  declare const App:
    | import('../shared').SvelteModule['default']
    | import('../shared').SvelteServerModule['default'];
  export default App;
}
