import type { BuildConfig, ResolvedBuildConfig } from './build-config';
import type { ClientConfig, ResolvedClientConfig } from './client-config';
import type {
  DirectoriesConfig,
  ResolvedDirectoriesConfig,
} from './directories-config';
import type { ResolvedEntryConfig } from './entry-config';
import type { MarkdownConfig, ResolvedMarkdownConfig } from './markdown-config';
import type { ResolvedRoutesConfig, RoutesConfig } from './routes-config';
import type { ResolvedSitemapConfig, SitemapConfig } from './sitemap-config';

export type ResolvedAppConfig = {
  debug: boolean;
  build: ResolvedBuildConfig;
  dirs: ResolvedDirectoriesConfig;
  entry: ResolvedEntryConfig;
  client: ResolvedClientConfig;
  routes: ResolvedRoutesConfig;
  markdown: ResolvedMarkdownConfig;
  sitemap: ResolvedSitemapConfig[];
  isBuild: boolean;
  isSSR: boolean;
};

export type AppConfig = Partial<{
  debug: boolean;
  build: BuildConfig;
  dirs: DirectoriesConfig;
  entry: ResolvedEntryConfig;
  client: ClientConfig;
  routes: RoutesConfig;
  markdown: MarkdownConfig;
  sitemap: SitemapConfig | SitemapConfig[];
}>;
