import type { SystemDirectory } from './_directory';
import { sortObjectKeys } from './utils/obj';

export type NodePackageManager = 'npm' | 'pnpm' | 'yarn';

export type PackageJsonBuilderInit = {
  target: SystemDirectory;
  version: string;
  link?: string;
};

export type PackageJson = {
  [key: string]: unknown;
  name: string;
  version: string;
  type?: 'module';
  private?: boolean;
  description?: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

export class PackageJsonBuilder {
  protected _target: SystemDirectory;
  protected _version: string;
  protected _pkg: PackageJson;

  readonly manager: NodePackageManager;

  constructor(protected readonly init: PackageJsonBuilderInit) {
    this._target = init.target;
    this._version = init.version;
    this.manager = this._whichPkgManager();
    this._pkg = this._target.exists('package.json')
      ? JSON.parse(this._target.readSync('package.json'))
      : { name: '', type: 'module', private: true };
    this._pkg.scripts = this._pkg.scripts ?? {};
    this._pkg.dependencies = this._pkg.dependencies ?? {};
    this._pkg.devDependencies = this._pkg.devDependencies ?? {};
  }

  addField(key: string, value: unknown, overwrite = false) {
    if (!this._pkg[key] || overwrite) this._pkg[key] = value;
  }

  getScript(name: string): string | undefined {
    return this._pkg.scripts[name];
  }

  findScriptName(name: string) {
    return Object.keys(this._pkg.scripts).some(
      (scriptName) => scriptName === name,
    );
  }

  testScriptName(regex: RegExp) {
    return Object.values(this._pkg.scripts).some((script) =>
      regex.test(script),
    );
  }

  addScript(name: string, script: string, overwrite: RegExp | boolean = false) {
    const boolCheck =
      typeof overwrite === 'boolean' &&
      (overwrite || !this.findScriptName(name));

    const regexCheck =
      overwrite instanceof RegExp && !this.testScriptName(overwrite);

    if (boolCheck || regexCheck) {
      this._pkg.scripts[name] = script;
    }
  }

  addDep(name: string, version: string) {
    this._pkg.dependencies[name] = version;
  }

  addDevDep(name: string, version: string) {
    this._pkg.devDependencies[name] = version;
  }

  addVesselDep(name: string) {
    this.addDevDep(
      `@vessel-js/${name}`,
      this.init.link
        ? `${this.manager === 'yarn' ? 'link:' : ''}${this.init.link}/${name}`
        : `^${this._version}`,
    );
  }

  hasField(name: string, value: string) {
    return this._pkg[name] === value;
  }

  hasDep(name: string) {
    return !!this._pkg.dependencies[name] || !!this._pkg.devDependencies[name];
  }

  async write() {
    this._pkg.dependencies = sortObjectKeys(this._pkg.dependencies);
    this._pkg.devDependencies = sortObjectKeys(this._pkg.devDependencies);

    if (Object.keys(this._pkg.dependencies).length === 0) {
      // @ts-expect-error - .
      this._pkg.dependencies = undefined;
    }

    await this._target.write(
      'package.json',
      JSON.stringify(this._pkg, null, 2),
    );
  }

  protected _whichPkgManager(): NodePackageManager {
    if (this._target.exists('package-lock.json')) return 'npm';
    if (this._target.exists('yarn.lock')) return 'yarn';
    if (this._target.exists('pnpm-lock.yaml')) return 'pnpm';
    return this._whichPkgManagerFromUserAgent()?.name ?? 'npm';
  }

  protected _whichPkgManagerFromUserAgent() {
    const userAgent = process.env.npm_config_user_agent;
    if (!userAgent) return null;
    const pkgSpec = userAgent.split(' ')[0];
    const pkgSpecArr = pkgSpec.split('/');
    return {
      name: pkgSpecArr[0] as NodePackageManager,
      version: pkgSpecArr[1],
    };
  }
}

export function isValidPackageName(name: string) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
    name,
  );
}

export function toValidPackageName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-');
}
