/* eslint-disable import/no-named-as-default-member */

import fs from 'node:fs';

import Markdoc, { type RenderableTreeNode, type Tag } from '@markdoc/markdoc';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { LRUCache } from 'lru-cache';
import * as path from 'pathe';

import { resolveStaticRouteFromFilePath, type RouteFile } from 'node';
import type { App } from 'node/app/App';
import type { MarkdownFrontmatter, MarkdownHeading, MarkdownMeta } from 'shared/markdown';
import { escapeHTML } from 'shared/utils/html';
import { isLinkExternal } from 'shared/utils/url';

import { renderMarkdocToHTML } from './render';
import type {
  HighlightCodeBlock,
  MarkdocTreeWalkStuff,
  ParseMarkdownConfig,
  ParseMarkdownResult,
} from './types';

const cache = new LRUCache<string, ParseMarkdownResult>({ max: 1024 });
const cacheK = new LRUCache<string, Set<string>>({ max: 1024 });

export function clearMarkdownCache(file?: string) {
  if (!file) {
    cache.clear();
  } else {
    for (const key of cacheK.get(file) ?? []) cache.delete(key);
  }
}

export function parseMarkdown(
  app: App,
  filePath: string,
  source: string,
  opts: Partial<ParseMarkdownConfig> = {},
): ParseMarkdownResult {
  const cacheKey = filePath + source;

  if (!opts.ignoreCache && cache.has(cacheKey)) return cache.get(cacheKey)!;

  const ast = Markdoc.parse(source, filePath);

  for (const transformer of opts.transformAst ?? []) {
    transformer({ filePath, ast, source });
  }

  const frontmatter: MarkdownFrontmatter = ast.attributes.frontmatter
    ? yaml.load(ast.attributes.frontmatter)
    : {};

  const nodeImports = app.markdoc.resolveOwnedImports(filePath);
  const config = app.markdoc.getOwnedConfig(filePath);
  const lastUpdated = Math.round(fs.statSync(filePath).mtimeMs);

  const content = Markdoc.transform(ast, {
    ...config,
    variables: {
      ...config.variables,
      frontmatter,
    },
  });

  for (const transformer of opts.transformContent ?? []) {
    transformer({ filePath, frontmatter, content });
  }

  const stuff: MarkdocTreeWalkStuff = {
    baseUrl: app.vite.resolved!.base,
    filePath,
    appDir: app.dirs.app.path,
    highlight: opts.highlight!,
    imports: new Set(),
    links: new Set(),
    headings: [],
  };

  walkRenderTree(content, stuff, (node) => {
    forEachRenderNode(node, stuff);
    for (const transformer of opts.transformTreeNode ?? []) {
      transformer({ node, stuff });
    }
  });

  const { headings } = stuff;
  const title = headings[0]?.level === 1 ? headings[0].title : null;

  const imports = Array.from(new Set([...nodeImports, ...Array.from(stuff.imports)]));

  const meta: MarkdownMeta = {
    title,
    headings,
    frontmatter,
    lastUpdated,
  };

  const leafFile = app.files.routes.findLeafFile(filePath);
  if (leafFile) mergeLayoutMeta(app, leafFile, meta, opts);

  for (const transformer of opts.transformMeta ?? []) {
    transformer({ filePath, meta, imports, stuff });
  }

  let output =
    (opts.render?.({ filePath, content, meta, imports, stuff }) ?? renderMarkdocToHTML(content)) ||
    '';

  for (const transformer of opts.transformOutput ?? []) {
    output = transformer({ filePath, meta, code: output, imports, stuff });
  }

  const result: ParseMarkdownResult = {
    meta,
    ast,
    filePath,
    output,
    stuff,
    content,
  };

  cache.set(cacheKey, result);

  if (!cacheK.has(filePath)) cacheK.set(filePath, new Set());
  cacheK.get(filePath)!.add(cacheKey);

  return result;
}

export function getFrontmatter(source: string | Buffer): MarkdownFrontmatter {
  const { data: frontmatter } = matter(source);
  return frontmatter;
}

function mergeLayoutMeta(
  app: App,
  leafFile: RouteFile,
  meta: MarkdownMeta,
  opts: Partial<ParseMarkdownConfig> = {},
) {
  const layoutFiles = app.files.routes
    .getDirBranch(leafFile.path.absolute)
    .map((group) => group.layout);

  for (const layoutFile of layoutFiles) {
    if (layoutFile) {
      if (!opts.filter?.(layoutFile.path.absolute) || layoutFile.ext !== '.md') {
        continue;
      }

      const { ast: layoutAst, meta: layoutMeta } = parseMarkdown(
        app,
        layoutFile.path.absolute,
        fs.readFileSync(layoutFile.path.absolute, { encoding: 'utf-8' }),
        opts,
      );

      let headingsPos = 0;
      for (const node of layoutAst.walk()) {
        if (node.type === 'heading') {
          headingsPos += 1;
        } else if (node.attributes.content === '<slot />') {
          break;
        }
      }

      meta.title = meta.title ?? layoutMeta.title;
      meta.frontmatter = { ...layoutMeta.frontmatter, ...meta.frontmatter };

      meta.headings = [
        ...(headingsPos > 0 ? layoutMeta.headings.slice(0, headingsPos) : layoutMeta.headings),
        ...meta.headings,
        ...(headingsPos > 0 ? layoutMeta.headings.slice(headingsPos) : []),
      ];

      if (layoutMeta.lastUpdated < meta.lastUpdated) {
        meta.lastUpdated = layoutMeta.lastUpdated;
      }
    }
  }
}

function walkRenderTree(
  node: RenderableTreeNode,
  stuff: MarkdocTreeWalkStuff,
  callback: (node: RenderableTreeNode, stuff: MarkdocTreeWalkStuff) => void,
) {
  callback(node, stuff);
  if (Markdoc.Tag.isTag(node)) {
    for (const child of node.children) {
      walkRenderTree(child, stuff, callback);
    }
  }
}

const codeNameRE = /^(code|Code)$/;
const fenceNameRE = /^(pre|Fence)$/;
const headingNameRE = /^(h\d|Heading)$/;
const linkNameRE = /^(a|link|Link)$/;
const importRE = /^import$/;

function forEachRenderNode(node: RenderableTreeNode, stuff: MarkdocTreeWalkStuff) {
  if (Markdoc.Tag.isTag(node)) {
    const name = node.name;
    if (codeNameRE.test(name)) {
      transformCode(node);
    } else if (fenceNameRE.test(name)) {
      highlightCodeFences(node, stuff.highlight);
    } else if (headingNameRE.test(name)) {
      collectHeadings(node, stuff.headings);
    } else if (linkNameRE.test(name)) {
      resolveLinks(node, stuff);
    } else if (importRE.test(name)) {
      // @ts-expect-error - ignore from render.
      node.name = null;
      const file = node.attributes.file;
      if (file) stuff.imports.add(`import "${file}";`);
    }
  }
}

function transformCode(tag: Tag) {
  const isComponent = tag.name === 'Code';
  const code = isComponent ? tag.attributes.content : tag.children[0];
  if (isComponent && typeof code === 'string') {
    tag.attributes.code = escapeHTML(code);
    tag.children[0] = null;
    delete tag.attributes.content;
  }
}

const preTagRE = /<\/?pre(.*?)>/g;
const preTagStyleAttrRE = /<pre.*?style="(.*?)"/;
function highlightCodeFences(tag: Tag, highlight: HighlightCodeBlock) {
  const isComponent = tag.name === 'Fence';
  const lang = isComponent ? tag.attributes.language : tag.attributes['data-language'];
  const code = isComponent ? tag.attributes.content : tag.children[0];

  if (typeof code === 'string') {
    const highlightedCode = highlight(code, lang);
    const styles = highlightedCode?.match(preTagStyleAttrRE)?.[1];
    const output = highlightedCode?.replace(preTagRE, '') ?? code;

    if (styles) {
      tag.attributes.style = (tag.attributes.style ?? '') + styles;
    }

    if (isComponent) {
      tag.attributes.lang = lang;
      tag.attributes.code = escapeHTML(code);
      if (highlightedCode) tag.attributes.highlightedCode = output;
      tag.children[0] = null;
      delete tag.attributes.language;
      delete tag.attributes['data-language'];
      delete tag.attributes.content;
    } else {
      tag.attributes.class = `${highlightedCode ? 'highlight ' : ''}lang-${lang}`;
      tag.children[0] = output;
    }
  }
}

function collectHeadings(tag: Tag, headings: MarkdownHeading[]) {
  const child = tag.children[0];

  const title = Markdoc.Tag.isTag(child)
    ? child?.children[0] ?? child?.attributes.content ?? ''
    : child;

  if (typeof title === 'string') {
    let id = tag.attributes.id ?? slugify(title);

    const duplicates = headings.filter((heading) => heading.id.replace(/-\d+$/, '') === id).length;
    if (duplicates) id = `${id}-${duplicates}`;

    const level = tag.attributes.level ?? Number(tag.name.match(/h(\d+)/)?.[1] ?? 0);

    tag.attributes.id = id;
    tag.attributes.level = level;

    headings.push({
      title,
      id,
      level,
    });
  }
}

function resolveLinks(tag: Tag, stuff: MarkdocTreeWalkStuff) {
  const href = tag.attributes.href;
  if (!href) return;

  const internalLinkMatch = href.match(
    /^((?:.*)(?:\/|\.md|\.html|\.svelte|\.vue|\.jsx|\.tsx))(#.*)?$/,
  );

  if (isLinkExternal(href, stuff.baseUrl)) {
    tag.attributes.target = '_blank';
    tag.attributes.rel = 'noopener noreferrer';
    return;
  }

  if (internalLinkMatch) {
    const rawPath = decodeURI(internalLinkMatch?.[1]);
    const rawHash = internalLinkMatch?.[2] ?? '';

    const absolutePath = rawPath?.startsWith('/')
      ? path.resolve(stuff.appDir, '.' + rawPath)
      : path.resolve(path.dirname(stuff.filePath), rawPath);

    const route = resolveStaticRouteFromFilePath(stuff.appDir, absolutePath);

    const resolvedHref = `${route}${rawHash}`;
    tag.attributes.href = resolvedHref;
    tag.attributes['data-prefetch'] = '';
    stuff.links.add(resolvedHref);
  }
}

// eslint-disable-next-line no-control-regex
const rControl = /[\u0000-\u001f]/g;
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;
const rCombining = /[\u0300-\u036F]/g;
function slugify(str: string) {
  return (
    str
      .normalize('NFKD')
      // Remove accents
      .replace(rCombining, '')
      // Remove control characters
      .replace(rControl, '')
      // Replace special characters
      .replace(rSpecial, '-')
      // Remove continuos separators
      .replace(/-{2,}/g, '-')
      // Remove prefixing and trailing separators
      .replace(/^-+|-+$/g, '')
      // Ensure it doesn't start with a number (#121)
      .replace(/^(\d)/, '_$1')
      // Lowercase
      .toLowerCase()
  );
}
