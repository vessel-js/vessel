import type {
  ConfigEnv as ViteConfigEnv,
  ViteDevServer,
  ResolvedConfig as ViteResolvedConfig,
  UserConfig as ViteUserConfig,
} from 'vite';

import type { MarkdocSchema } from 'node/markdoc';
import type { logger } from 'node/utils';

import type { ResolvedAppConfig } from './config/app-config';
import type { DisposalBin } from './create/disposal-bin';
import type { AppFiles } from './files';
import type { AppRoutes } from './routes';

export interface AppDetails {
  version: string;
  dirs: AppDirectories;
  vite: { env: ViteConfigEnv };
  config: ResolvedAppConfig;
}

export interface AppFactory extends AppDetails {
  create(): Promise<App>;
}

export interface App extends AppDetails {
  /** Plugin extensions. */
  [x: string]: unknown;
  context: Map<string, unknown>;
  files: AppFiles;
  routes: AppRoutes;
  markdoc: MarkdocSchema;
  disposal: DisposalBin;
  logger: typeof logger;
  vite: {
    env: ViteConfigEnv;
    user: ViteUserConfig;
    /** Available after core plugin `configResolved` hook runs. */
    resolved?: ViteResolvedConfig;
    /** Available during dev mode after core plugin `configureServer` hook runs. */
    server?: ViteDevServer;
  };
  destroy: () => void;
}

export interface AppDirectories {
  cwd: Directory;
  root: Directory;
  workspace: Directory;
  app: Directory;
  build: Directory;
  public: Directory;
  vessel: {
    root: Directory;
    client: Directory;
    server: Directory;
  };
}

export interface Directory {
  /** Absolute path to directory. */
  path: string;
  /** Read contents of file relative to current directory. */
  read: (filePath: string) => string;
  /** Resolve file path relative to current directory. */
  resolve: (...path: string[]) => string;
  /** Resolve relative file path to current directory. */
  relative: (...path: string[]) => string;
  /** Write contents to file relative to current directory. */
  write: (filePath: string, data: string) => void;
  /** Resolve glob relative to current directory. */
  glob: (pattern: string | string[]) => string[];
}

export { type DisposalBin };
