import type { App } from 'node/app/App';

import type { BuildData } from '../build-data';

export type BuildAdapterFactory = (
  app: App,
  build: BuildData,
) => BuildAdapter | Promise<BuildAdapter>;

// Really basic for now but we can expand on it later.
export type BuildAdapter = {
  name: string;
  write?(): void | Promise<void>;
};
