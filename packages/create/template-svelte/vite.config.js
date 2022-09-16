import { svelte } from '@sveltejs/vite-plugin-svelte';
import { vessel } from '@vessel-js/app/node';
import { vesselSvelte } from '@vessel-js/svelte/node';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vessel(),
    vesselSvelte(),
    svelte({
      extensions: ['.svelte', '.md'],
      compilerOptions: {
        hydratable: true,
      },
    }),
  ],
});
