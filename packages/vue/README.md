# Vessel Vue

This package adds [Vue](https://vuejs.org) support to Vessel.

```bash
npm install @vessel-js/vue
```

```js
// vite.config.js
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
```
