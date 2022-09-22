import type { App } from 'node/app/App';

import { type BuildBundles, type BuildData } from '../build';
import { type BuildAdapterUtils } from './build-utils';

export type BuildAdapterFactory = (
  app: App,
  bundles: BuildBundles,
  build: BuildData,
  utils: BuildAdapterUtils,
) => BuildAdapter | Promise<BuildAdapter>;

// Really basic for now but we can expand on it later.
export type BuildAdapter = {
  name: string;
  startRenderingPages?(): void | Promise<void>;
  finishRenderingPages?(): void | Promise<void>;
  write?(): void | Promise<void>;
  close?(): void | Promise<void>;
};
