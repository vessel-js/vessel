import kleur from 'kleur';
import * as path from 'pathe';
import { toPascalCase } from 'shared/utils/string';

import type { App } from '../App';
import { SystemFiles, type SystemFileMeta, type SystemFilesOptions } from './system-files';

export const STRIP_MARKDOC_DIR_RE = /\/\.markdoc\/.+/;

export type MarkdocFile = SystemFileMeta & {
  type: 'node' | 'tag';
  name: string;
  cname: string;
  inline: boolean;
  owningDir: string;
};

export class MarkdocFiles extends SystemFiles<MarkdocFile> {
  init(app: App, options?: Partial<SystemFilesOptions>) {
    return super.init(app, {
      include: app.config.markdown.nodes.include,
      exclude: app.config.markdown.nodes.exclude,
      ...options,
    });
  }

  async add(filePath: string) {
    const file = this._createFile(filePath);

    const owningDir = path.dirname(file.path.root.replace(STRIP_MARKDOC_DIR_RE, '/root.md'));

    const name = path
      .basename(file.path.route, path.extname(file.path.route))
      .replace('@node', '')
      .replace('@inline', '');

    const type = this.isNode(filePath) ? 'node' : 'tag';

    if (type === 'node' && !isValidMarkdownNodeName(name)) {
      const validValues = `${kleur.bold('Valid values')}: ${Array.from(getValidNodeNames())}`;

      this._app.logger.warn(`Invalid markdown node name [${kleur.bold(name)}]. \n\n${validValues}`);
    }

    const cname = toPascalCase(name);
    const inline = /@inline/.test(file.path.route);

    const node: MarkdocFile = {
      ...file,
      name,
      type,
      cname,
      inline,
      owningDir,
    };

    this._addFile(node);
    return node;
  }

  isNode(filePath: string) {
    return this.isAnyNode(filePath) && filePath.includes('@node');
  }

  isTag(filePath: string) {
    return this.isAnyNode(filePath) && !filePath.includes('@node');
  }

  isAnyNode(filePath: string) {
    return filePath.includes('.markdoc') && this._filter(filePath);
  }

  getOwnedNodes(ownerFilePath: string, type: '*' | 'node' | 'tag') {
    const root = path.dirname(this._getRootPath(ownerFilePath));
    return Array.from(this._files).filter((node) => {
      return (type === '*' || node.type === type) && root.startsWith(node.owningDir);
    });
  }
}

const validNodeNames = new Set([
  'document',
  'heading',
  'paragraph',
  'blockquote',
  'hr',
  'image',
  'fence',
  'tag',
  'list',
  'item',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'inline',
  'strong',
  'em',
  's',
  'link',
  'code',
  'text',
  'hardbreak',
  'softbreak',
]);

function getValidNodeNames() {
  return validNodeNames;
}

function isValidMarkdownNodeName(name: string) {
  return validNodeNames.has(name);
}
