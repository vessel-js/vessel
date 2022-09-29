import { vessel } from '@vessel-js/app/node';
import { vesselVue } from '@vessel-js/vue/node';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vessel(),
    vesselVue(),
    vue({
      include: [/\.vue$/, /\.md$/],
    }),
  ],
});
