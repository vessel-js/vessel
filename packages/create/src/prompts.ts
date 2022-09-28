import enquirer from 'enquirer';

import {
  BUILDER_ADDONS,
  BuilderAddon,
  JS_FRAMEWORKS,
  JSFramework,
} from './builder';

export function overwriteDirectoryPrompt(
  name?: string,
): Promise<{ overwrite: boolean }> {
  return enquirer.prompt({
    type: 'confirm',
    name: 'overwrite',
    message: `${name ? `${name} directory` : 'Directory'} exists. Overwrite?`,
    initial: false,
  });
}

export function setupPrompt({ projectName }): Promise<{
  name: string;
  framework: JSFramework;
  addons: BuilderAddon[];
}> {
  return enquirer.prompt(
    [
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        initial: projectName,
      },
      {
        type: 'select',
        name: 'framework',
        message: 'Select a framework:',
        initial: 0,
        choices: JS_FRAMEWORKS,
      },
      {
        type: 'multiselect',
        name: 'addons',
        message: 'Addons:',
        choices: BUILDER_ADDONS,
      },
    ].filter(Boolean),
  );
}
