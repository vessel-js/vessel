import type { Builder } from '../builder';

export async function eslintAddon(builder: Builder) {
  if (!builder.hasAddon('eslint')) return;

  builder.addGitIgnore('.eslintcache');

  builder.pkg.addDevDep('npm-run-all', '^4.0.0');
  builder.pkg.addDevDep('eslint', '^7.0.0');
  builder.pkg.addDevDep('eslint-plugin-import', '^2.0.0');
  builder.pkg.addDevDep('eslint-plugin-simple-import-sort', '^7.0.0');

  builder.pkg.addScript('lint', 'run-s lint:*');

  const lintExts = resolveLintExtensions(builder);
  builder.pkg.addScript(
    'lint:eslint',
    `eslint --ext ${lintExts.join(',')} . --ignore-path .gitignore`,
  );

  builder.pkg.addScript('format', 'run-s format:*');
  builder.pkg.addScript('format:eslint', 'npm run lint:eslint -- --fix');

  if (builder.hasAddon('prettier')) {
    builder.pkg.addDevDep('eslint-config-prettier', '^8.0.0');
  }

  if (builder.hasAddon('typescript')) {
    builder.pkg.addDevDep('@typescript-eslint/eslint-plugin', '^4.0.0');
    builder.pkg.addDevDep('@typescript-eslint/parser', '^4.0.0');
    builder.pkg.addDevDep('eslint-import-resolver-typescript', '^2.5.0');
  }

  if (builder.framework === 'vue') {
    builder.pkg.addDevDep('eslint-plugin-vue', '^8.0.0');
  }

  if (builder.framework === 'svelte') {
    builder.pkg.addDevDep('eslint-plugin-svelte3', '^3.0.0');
  }

  const config = JSON.stringify(resolveConfig(builder), null, 2);

  await builder.dirs.target.write(
    '.eslintrc.js',
    `module.exports = ${config};`,
  );
}

function resolveConfig(builder: Builder) {
  const framework = builder.framework;
  const typescript = builder.hasAddon('typescript');

  const config =
    (/p?react|solid/.test(framework) && resolveBaseConfig({ typescript })) ||
    (framework === 'svelte' && resolveSvelteConfig({ typescript })) ||
    resolveVueConfig({ typescript });

  if (builder.hasAddon('prettier')) config.extends.push('prettier');

  return config;
}

function resolveBaseConfig({ typescript = false }) {
  return {
    env: {
      browser: true,
      es6: true,
      node: true,
    },
    parser: typescript ? '@typescript-eslint/parser' : undefined,
    parserOptions: {
      project: typescript ? './tsconfig.json' : undefined,
      parser: typescript ? '@typescript-eslint/parser' : undefined,
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    ignorePatterns: ['.eslintrc.js'],
    plugins: [typescript && '@typescript-eslint', 'simple-import-sort'].filter(
      Boolean,
    ),
    overrides: [] as { files: string[]; processor: string }[],
    extends: [
      'eslint:recommended',
      typescript && 'plugin:@typescript-eslint/recommended',
      'plugin:import/recommended',
      typescript && 'plugin:import/typescript',
    ].filter(Boolean),
    rules: {
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error',
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json'],
        },
      },
    },
  };
}

function resolveVueConfig({ typescript = false }) {
  const config = resolveBaseConfig({ typescript });
  config.parser = 'vue-eslint-parser';
  config.extends.push('plugin:vue/vue3-recommended');
  return config;
}

function resolveSvelteConfig({ typescript = false }) {
  const config = resolveBaseConfig({ typescript });

  config.plugins.unshift('svelte3');

  config.overrides.push({
    files: ['*.svelte'],
    processor: 'svelte3/svelte3',
  });

  if (typescript) {
    config.settings['svelte3/typescript'] = true;
  }

  return config;
}

export function resolveLintExtensions(builder: Builder) {
  const supportsJsx = /(vue|p?react|solid)/.test(builder.framework);
  const withTypescript = builder.hasAddon('typescript');
  return [
    '.js',
    supportsJsx && '.jsx',
    withTypescript && '.ts',
    supportsJsx && withTypescript && '.tsx',
    builder.framework === 'vue' && '.vue',
    builder.framework === 'svelte' && '.svelte',
  ].filter(Boolean) as string[];
}
