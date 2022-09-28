import kleur from 'kleur';
import minimist from 'minimist';
import { existsSync } from 'node:fs';
import * as path from 'pathe';

import { eslintAddon } from './addons/eslint';
import { lintStagedAddon } from './addons/lint-staged';
import { prettierAddon } from './addons/prettier';
import { tailwindAddon } from './addons/tailwind';
import { typescriptAddon } from './addons/typescript';
import { Builder } from './builder';
import { toValidPackageName } from './package';
import { setupPrompt } from './prompts';
import { removeTrailingSlash, toTitleCase } from './utils/str';

const argv = minimist(process.argv.slice(2), { string: ['_'] });

export async function run() {
  const targetDirArg = argv._[0];

  if (!targetDirArg) {
    console.log(
      kleur.yellow(
        `\n[vessel] missing project name \n\nnpm init vessel ${kleur.bold(
          'my-project',
        )}\n`,
      ),
    );
    return;
  }

  const targetDir = path.resolve(process.cwd(), targetDirArg);
  const link =
    typeof argv.link === 'string' ? removeTrailingSlash(argv.link) : undefined;

  if (existsSync(targetDir)) {
    console.log(
      kleur.red(`\nDirectory ${kleur.dim(`(${targetDir})`)} is not empty.\n`),
    );
    return;
  }

  const userProjectName = targetDirArg ? toTitleCase(targetDirArg) : undefined;
  const userInput = await setupPrompt({ projectName: userProjectName });
  const userPkgName = toValidPackageName(targetDirArg ?? 'vessel');

  console.log(kleur.magenta(`\n🏗️ [vessel] ${kleur.bold(targetDir)}`));

  const builder = new Builder({
    target: targetDir,
    framework: userInput.framework,
    addons: userInput.addons,
    link,
  });

  console.log(kleur.bold(kleur.cyan(`\nvessel@${builder.version}\n`)));

  builder.pkg.addField('name', userPkgName);

  const scripts = ['dev', 'build', 'preview'];
  for (const script of scripts) {
    builder.pkg.addScript(`${script}`, `vite ${script}`);
  }

  // -------------------------------------------------------------------------------------------
  // Dependencies
  // -------------------------------------------------------------------------------------------

  builder.pkg.addDevDep('vite', '^3.1.0');
  builder.pkg.addVesselDep('app');

  switch (builder.framework) {
    case 'svelte':
      builder.pkg.addVesselDep('svelte');
      builder.pkg.addDevDep('svelte', '^3.40.0');
      builder.pkg.addDevDep('@sveltejs/vite-plugin-svelte', '^1.0.0');
      builder.pkg.addDevDep('svelte-preprocess', '^4.10.0');
      if (builder.hasAddon('typescript')) {
        builder.pkg.addDevDep('@tsconfig/svelte', '^3.0.0');
        builder.pkg.addDevDep('svelte-check', '^2.9.0');
      }
      break;
    case 'vue':
      builder.pkg.addVesselDep('vue');
      builder.pkg.addDep('vue', '^3.0.0');
      builder.pkg.addDevDep('@vue/compiler-sfc', '^3.2.0');
      builder.pkg.addDevDep('@vitejs/plugin-vue', '^3.1.0');
      if (builder.hasAddon('typescript')) {
        builder.pkg.addDevDep('vue-tsc', '^0.40.0');
      }
      break;
    case 'react':
      builder.pkg.addVesselDep('react');
      builder.pkg.addDep('react', '^18.0.0');
      builder.pkg.addDep('react-dom', '^18.0.0');
      builder.pkg.addDevDep('@vitejs/plugin-react', '^2.1.0');
      if (builder.hasAddon('typescript')) {
        builder.pkg.addDevDep('@types/react', '^18.0.0');
        builder.pkg.addDevDep('@types/react-dom', '^18.0.0');
      }
      break;
    case 'preact':
      builder.pkg.addVesselDep('preact');
      builder.pkg.addDep('preact', '^10.5.0');
      builder.pkg.addDep('preact-render-to-string', '^5.1.0');
      builder.pkg.addDevDep('@preact/preset-vite', '^2.4.0');
      break;
    case 'solid':
      builder.pkg.addVesselDep('solid');
      builder.pkg.addDep('solid-js', '^1.5.0');
      builder.pkg.addDevDep('vite-plugin-solid', '^2.3.0');
      break;
  }

  // -------------------------------------------------------------------------------------------
  // Addons
  // -------------------------------------------------------------------------------------------

  const addons = [
    typescriptAddon,
    eslintAddon,
    prettierAddon,
    lintStagedAddon,
    tailwindAddon,
  ];

  for (const addon of addons) {
    await addon(builder);
  }

  // -------------------------------------------------------------------------------------------
  // Template
  // -------------------------------------------------------------------------------------------

  await builder.dirs.template.copy(
    `./template-${builder.framework}`,
    builder.dirs.target.path,
  );

  // -------------------------------------------------------------------------------------------
  // Finish
  // -------------------------------------------------------------------------------------------

  await builder.writeGitIgnore();
  await builder.pkg.write();
  await builder.runHooks('postBuild');

  console.log(kleur.bold(kleur.green(`✅ Done. Now run:\n`)));
  console.log(kleur.bold(`  cd ${path.relative(process.cwd(), targetDir)}`));

  const packageManager = builder.pkg.manager;
  switch (packageManager) {
    case 'yarn':
      console.log(kleur.bold('  yarn'));
      console.log(kleur.bold(`  yarn dev`));
      break;
    case 'pnpm':
      console.log(kleur.bold('  pnpm install'));
      console.log(kleur.bold(`  pnpm dev`));
      break;
    default:
      console.log(kleur.bold(`  ${packageManager} install`));
      console.log(kleur.bold(`  ${`${packageManager} run`} dev`));
      break;
  }

  const nodeVersion = await builder.getNodeMajorVersion();
  if (nodeVersion < 16) {
    console.warn(
      `\n\n⚠️ ${kleur.yellow(
        `This package requires your Node.js version to be \`>=16\` to work properly (detected v${nodeVersion}).`,
      )}`,
      `\n\n1. Install Volta to automatically manage it by running: ${kleur.bold(
        'https://get.volta.sh | bash',
      )}`,
      `\n2. Make sure you're inside the correct directory: ${kleur.bold(
        `cd ${path.relative(process.cwd(), targetDir)}`,
      )}`,
      `\n3. Pin the package version: ${kleur.bold('volta pin node@16')}`,
      "\n4. Done! Run `npm` commands as usual and it'll just work :)",
      `\n\nSee ${kleur.bold('https://volta.sh')} for more information.`,
      '\n',
    );
  }

  console.log();
}
