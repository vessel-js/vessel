import type { SvelteComponent } from 'svelte';

export type SvelteConstructor = typeof SvelteComponent;

export interface SvelteModule {
  readonly [id: string]: unknown;
  readonly default: SvelteConstructor;
}

export interface SvelteServerModule {
  readonly [id: string]: unknown;
  readonly default: {
    render(
      props: Record<string, unknown>,
      options: { context: Map<string | symbol, unknown> },
    ): {
      html: string;
      head: string;
      css?: string | { code: string; map: string | null };
    };
  };
}

export {};
