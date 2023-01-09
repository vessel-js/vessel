export interface MarkdownMeta {
  title?: string | null;
  headings: MarkdownHeading[];
  frontmatter: MarkdownFrontmatter;
  lastUpdated: number;
}

export interface MarkdownFrontmatter extends Record<string, any> {}

export interface MarkdownHeading {
  level: number;
  title: string;
  id: string;
}

export interface MarkdownModule {
  __markdownMeta: MarkdownMeta;
}
