import type { App } from 'node/app/App';
import type { AppConfig, ResolvedAppConfig } from 'node/app/config';
import type { Plugin as VitePlugin } from 'vite';

export type VesselPlugin = VitePlugin & {
  vessel?: {
    /**
     * Whether to run before core Vessel plugins or after.
     */
    enforce?: 'pre' | 'post';
    /**
     * Overrides client and server entry files.
     */
    entry?: App['entry'];
    /**
     * Hook for extending the Vessel app configuration.
     */
    config?: (
      config: ResolvedAppConfig,
    ) =>
      | Omit<AppConfig, 'dirs'>
      | null
      | void
      | Promise<Omit<AppConfig, 'dirs'> | null | void>;
    /**
     * Called immediately after the config has been resolved.
     */
    configureApp?: (app: App) => void | Promise<void>;
  };
};

export type VesselPluginOption = VesselPlugin | false | null | undefined;

export type VesselPlugins =
  | VesselPluginOption
  | Promise<VesselPluginOption>
  | (VesselPluginOption | Promise<VesselPluginOption>)[];
