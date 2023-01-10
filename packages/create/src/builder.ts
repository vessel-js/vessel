import { exec } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import * as path from 'pathe';

import { createSystemDirectory, type SystemDirectory } from './directory';
import { PackageJsonBuilder } from './package';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const vesselPkgPath = path.resolve(__dirname, '../package.json');
const vesselPkg = JSON.parse(fs.readFileSync(vesselPkgPath, 'utf-8'));

export type JSFramework = 'svelte' | 'vue' | 'solid' | 'preact';

export const JS_FRAMEWORKS: JSFramework[] = ['svelte', 'vue', 'solid', 'preact'];

export type BuilderAddon =
  | 'prettier'
  | 'eslint'
  | 'markdown'
  | 'lint-staged'
  | 'tailwind'
  | 'typescript';

export const BUILDER_ADDONS: BuilderAddon[] = [
  'eslint',
  'lint-staged',
  'prettier',
  'tailwind',
  'typescript',
];

const DEFAULT_GIT_IGNORE = ['.DS_STORE', '.vercel/', '.vessel/', 'build/', 'node_modules/'];

export interface BuilderInit {
  target: string;
  framework: JSFramework;
  addons: BuilderAddon[];
  link?: string;
}

export interface BuilderHooks {
  postBuild: (() => void | Promise<void>)[];
}

export class Builder {
  readonly framework: JSFramework;
  readonly pkg: PackageJsonBuilder;

  readonly dirs: {
    target: SystemDirectory;
    app: SystemDirectory;
    template: SystemDirectory;
  };

  get version() {
    return vesselPkg.version;
  }

  protected readonly _addons: BuilderAddon[];
  protected readonly _gitIgnore = new Set(DEFAULT_GIT_IGNORE);

  protected readonly _hooks: BuilderHooks = {
    postBuild: [],
  };

  constructor(init: BuilderInit) {
    this.framework = init.framework;
    this._addons = init.addons;

    this.dirs = {
      target: createSystemDirectory(init.target),
      app: createSystemDirectory(init.target, 'app'),
      template: createSystemDirectory(__dirname, '../'),
    };

    this.pkg = new PackageJsonBuilder({
      target: this.dirs.target,
      version: this.version,
      link: init.link,
    });
  }

  hasAddon(addon: BuilderAddon) {
    return this._addons.includes(addon);
  }

  addGitIgnore(path: string) {
    this._gitIgnore.add(path);
  }

  addHook(type: keyof BuilderHooks, callback: () => void | Promise<void>) {
    this._hooks[type].push(callback);
  }

  async runHooks(name: keyof BuilderHooks) {
    await Promise.all(this._hooks[name].map((fn) => fn()));
  }

  async writeGitIgnore() {
    const filename = '.gitignore';
    const ignore = Array.from(this._gitIgnore);

    if (!this.dirs.target.exists(filename)) {
      this.dirs.target.write(filename, ignore.join('\n'));
    } else {
      let content = await this.dirs.target.read(filename);

      for (const path of ignore) {
        if (!content.includes(path)) content += '\n' + path;
      }

      await this.dirs.target.write(filename, content);
    }
  }

  async getNodeMajorVersion() {
    const nodeV = await promisify(exec)('node -v');
    return parseInt(nodeV.stdout.slice(1).split('.')[0]);
  }
}
