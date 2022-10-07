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
      extensions: ['.tsx', '.jsx', '.md'],
    }),
  ],
});
