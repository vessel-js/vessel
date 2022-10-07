/// <reference types="vite/client" />
/// <reference types="@vessel-js/app/globals" />
/// <reference types="@vessel-js/solid/globals" />

interface ImportMetaEnv {
  // Declare client-side environment variables here: `PUBLIC_SOME_KEY=value`
  // Access them like so: `import.meta.env.PUBLIC_SOME_KEY`
  // Learn more: https://vitejs.dev/guide/env-and-mode.html#env-files
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface VesselRoutes {
  // <-- AUTOGEN_ROUTES_START -->
  1: '/';
  // <-- AUTOGEN_ROUTES_END -->
}
