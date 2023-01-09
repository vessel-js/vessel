import type { Builder } from '../builder';

export async function typescriptAddon(builder: Builder) {
  if (!builder.hasAddon('typescript')) return;

  builder.pkg.addDevDep('typescript', '^4.4.0');
  builder.pkg.addDevDep('@types/node', '^16.0.0');

  if (builder.framework === 'svelte') {
    builder.pkg.addScript('check', 'svelte-check');
  } else if (builder.framework === 'vue') {
    builder.pkg.addScript('check', 'vue-tsc');
  } else {
    builder.pkg.addScript('check', 'tsc');
  }

  const preact = builder.framework === 'preact';
  const solid = builder.framework === 'solid';

  const config =
    builder.framework === 'svelte'
      ? resolveSvelteConfig()
      : builder.framework === 'vue'
      ? resolveVueConfig()
      : resolveConfig({
          jsx: 'preserve',
          jsxFactory: preact || solid ? 'h' : undefined,
          jsxFragmentFactory: preact || solid ? 'Fragment' : undefined,
          jsxImportSource: preact ? 'preact' : solid ? 'solid-js' : undefined,
        });

  await builder.dirs.target.write('tsconfig.json', JSON.stringify(config, null, 2));
}

function resolveSvelteConfig() {
  return {
    extends: '@tsconfig/svelte/tsconfig.json',
    compilerOptions: {
      allowJs: true,
      checkJs: true,
      isolatedModules: true,
      module: 'esnext',
      moduleResolution: 'node',
      resolveJsonModule: true,
      target: 'esnext',
      useDefineForClassFields: true,
    },
    include: ['app'],
  };
}

function resolveVueConfig() {
  return {
    ...resolveConfig(),
    include: ['app/**/*.ts', 'app/**/*.tsx', 'app/**/*.vue'],
  };
}

function resolveConfig(compilerOptions = {}) {
  return {
    compilerOptions: {
      allowJs: true,
      allowSyntheticDefaultImports: true,
      allowUnreachableCode: false,
      alwaysStrict: true,
      checkJs: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      forceConsistentCasingInFileNames: true,
      lib: ['dom', 'dom.iterable', 'esnext'],
      module: 'esnext',
      moduleResolution: 'node',
      newLine: 'lf',
      noEmit: true,
      noImplicitReturns: true,
      preserveWatchOutput: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      strictNullChecks: true,
      target: 'esnext',
      useDefineForClassFields: false,
      ...compilerOptions,
    },
    include: ['app'],
  };
}
