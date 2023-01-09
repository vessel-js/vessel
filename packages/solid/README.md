# Vessel Solid

This package adds [Solid JS](https://www.solidjs.com) support to Vessel.

```bash
npm install @vessel-js/solid
```

```js
// vite.config.js
import { vessel } from '@vessel-js/app/node';
import { vesselSolid } from '@vessel-js/solid/node';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    vessel(),
    vesselSolid(),
    solid({
      ssr: true,
      extensions: ['.md'],
    }),
  ],
});
```
