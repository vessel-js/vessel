import type { Builder } from '../builder';

export async function prettierAddon(builder: Builder) {
  if (!builder.hasAddon('prettier')) return;

  builder.pkg.addDevDep('npm-run-all', '^4.0.0');
  builder.pkg.addDevDep('prettier', '^2.0.0');

  if (builder.hasAddon('typescript')) {
    builder.pkg.addDevDep('prettier-plugin-tailwindcss', '^0.2.0');
  }

  builder.pkg.addScript('lint', 'run-s lint:*');
  builder.pkg.addScript(
    'lint:prettier',
    'prettier . --check --ignore-path .gitignore --loglevel warn',
  );

  builder.pkg.addScript('format', 'run-s format:*');
  builder.pkg.addScript('format:prettier', 'npm run lint:prettier -- --write');

  const config = {
    singleQuote: true,
    printWidth: 80,
    tabWidth: 2,
    trailingComma: 'all',
  };

  await builder.dirs.target.write('.prettierrc', JSON.stringify(config, null, 2));
}
