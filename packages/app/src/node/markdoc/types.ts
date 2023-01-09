import type { Node, RenderableTreeNode } from '@markdoc/markdoc';
import type { MarkdownFrontmatter, MarkdownHeading, MarkdownMeta } from 'shared/markdown';

export interface HighlightCodeBlock {
  (code: string, lang: string): string | undefined | null;
}

export interface MarkdocTreeWalkStuff {
  [id: string]: any;
  baseUrl: string;
  filePath: string;
  appDir: string;
  links: Set<string>;
  imports: Set<string>;
  headings: MarkdownHeading[];
  highlight: HighlightCodeBlock;
}

export interface MarkdocTreeNodeTransformer {
  (data: { node: RenderableTreeNode; stuff: MarkdocTreeWalkStuff }): void;
}

export interface MarkdocAstTransformer {
  (data: { ast: Node; filePath: string; source: string }): void;
}

export interface MarkdocContentTransformer {
  (data: {
    filePath: string;
    content: RenderableTreeNode;
    frontmatter: MarkdownFrontmatter;
  }): string;
}

export interface MarkdocMetaTransformer {
  (data: {
    filePath: string;
    imports: string[];
    stuff: MarkdocTreeWalkStuff;
    meta: MarkdownMeta;
  }): void;
}

export interface MarkdocOutputTransformer {
  (data: {
    filePath: string;
    code: string;
    imports: string[];
    stuff: MarkdocTreeWalkStuff;
    meta: MarkdownMeta;
  }): string;
}

export interface MarkdocRenderer {
  (data: {
    filePath: string;
    content: RenderableTreeNode;
    imports: string[];
    stuff: MarkdocTreeWalkStuff;
    meta: MarkdownMeta;
  }): string;
}

export interface ParseMarkdownConfig {
  ignoreCache?: boolean;
  filter: (id: string) => boolean;
  highlight: HighlightCodeBlock;
  transformAst: MarkdocAstTransformer[];
  transformTreeNode: MarkdocTreeNodeTransformer[];
  transformContent: MarkdocContentTransformer[];
  transformMeta: MarkdocMetaTransformer[];
  transformOutput: MarkdocOutputTransformer[];
  render: MarkdocRenderer;
}

export interface ParseMarkdownResult {
  filePath: string;
  output: string;
  meta: MarkdownMeta;
  ast: Node;
  stuff: MarkdocTreeWalkStuff;
  content: RenderableTreeNode;
}
