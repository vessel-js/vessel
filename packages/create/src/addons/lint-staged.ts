import type { Builder } from '../builder.js';
import { resolveLintExtensions } from './eslint.js';

export async function lintStagedAddon(builder: Builder) {
  if (!builder.hasAddon('lint-staged')) return;

  builder.pkg.addDevDep('husky', '^7.0.0');
  builder.pkg.addDevDep('lint-staged', '^11.0.0');

  const prepareScript = builder.pkg.getScript('prepare');

  if (prepareScript && !prepareScript.includes('husky install')) {
    builder.pkg.addDevDep('prepare', `${prepareScript} husky install`);
  } else if (!prepareScript) {
    builder.pkg.addScript('prepare', `husky install`);
  }

  const lintStaged = builder.pkg['lint-staged'] ?? {};
  const lintExts = resolveLintExtensions(builder);

  builder.pkg.addField('lint-staged', lintStaged);

  if (builder.hasAddon('eslint')) {
    const glob = `*.{${lintExts.map((s) => s.slice(1)).join(',')}}`;
    lintStaged[glob] = 'eslint --cache --fix';
  }

  if (builder.hasAddon('prettier')) {
    const glob = `*.{${[...lintExts.map((s) => s.slice(1)), 'md', 'json'].join(
      ',',
    )}}`;
    lintStaged[glob] = 'prettier --write';
  }

  const preCommitPath = '.husky/pre-commit';
  if (!builder.dirs.target.exists(preCommitPath)) {
    await builder.dirs.target.write(
      preCommitPath,
      [
        '#!/bin/sh',
        '',
        '. "$(dirname "$0")/_/husky.sh"',
        '',
        'npx lint-staged',
      ].join('\n'),
    );
  } else {
    await builder.dirs.target.append(preCommitPath, 'npx lint-staged');
  }
}
