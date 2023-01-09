import type { AutoBuildAdapterConfig, BuildAdapterFactory } from 'node/build/adapter';

export interface ResolvedBuildConfig {
  adapter: BuildAdapterFactory | AutoBuildAdapterConfig;
}

export interface BuildConfig extends Partial<ResolvedBuildConfig> {}
