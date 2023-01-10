import {
  escapeHTML,
  Markdoc,
  renderMarkdocToHTML,
  toPascalCase,
  type MarkdocConfig,
  type MarkdocRenderer,
  type MarkdocTag,
  type MarkdocTreeNodeTransformer,
  type MarkdocTreeWalkStuff,
  type RenderMarkdocConfig,
} from '@vessel-js/app/node';
import * as path from 'pathe';

export const vueMarkdocTags: MarkdocConfig['tags'] = {
  component: {
    render: 'vue:component',
    transform(node, config) {
      return new Markdoc.Tag('vue:component', node.attributes, node.transformChildren(config));
    },
  },
};

// Care for strings that have been JSON stringified ("...")
const propRE = /^(?:"|\$obj::)/;
const objRE = /^\$obj::/;
const stripSlotWrapperRE = /<p><slot(.*?)\/?><\/p>/g;

const markObj = (name: string) => {
  return `$obj::${name}`;
};

const renderAttr: RenderMarkdocConfig['attr'] = (_, name, value) => {
  const isString = typeof value === 'string';
  return isString && !propRE.test(value)
    ? `${name}="${value}"`
    : `:${name}="${isString ? value.replace(objRE, '') : value}"`;
};

export const renderMarkdoc: MarkdocRenderer = ({ meta, content, imports }) => {
  let markup = renderMarkdocToHTML(content, { attr: renderAttr });

  markup = markup
    .substring('<article>'.length, markup.length - '</article>'.length)
    .replace(stripSlotWrapperRE, '<slot$1/>');

  const scriptModule = [
    '<script>',
    `  export const __markdownMeta = ${JSON.stringify(meta)};`,
    '</script>',
  ].join('\n');

  const script = imports.length > 0 ? ['<script setup>', ...imports, '</script>'].join('\n') : '';

  return `${scriptModule}\n\n${script}\n\n<template>${markup}</template>`;
};

const imgRE = /^img$/;
const codeNameRE = /^(code|Code)$/;
const fenceNameRE = /^(pre|Fence)$/;
const vueComponentNameRE = /^vue:component$/;

export const transformTreeNode: MarkdocTreeNodeTransformer = ({ node, stuff }) => {
  if (Markdoc.Tag.isTag(node)) {
    const name = node.name;
    if (codeNameRE.test(name)) {
      escapeCodeContent(node);
    } else if (fenceNameRE.test(name)) {
      escapeFenceContent(node);
    } else if (vueComponentNameRE.test(name)) {
      resoleVueComponent(node, stuff);
    } else if (imgRE.test(name)) {
      resolveImg(node, stuff);
    }
  }
};

function resolveImg(tag: MarkdocTag, stuff: MarkdocTreeWalkStuff) {
  const src = tag.attributes.src;
  const name = `${toPascalCase(path.basename(src, path.extname(src)))}Image`;
  stuff.imports.add(`import ${name} from "${src}";`);
  tag.attributes.src = markObj(name);
}

function resoleVueComponent(tag: MarkdocTag, stuff: MarkdocTreeWalkStuff) {
  const { is: filePath } = tag.attributes;
  const cname = toPascalCase(path.basename(filePath, path.extname(filePath)));
  stuff.imports.add(`import ${cname} from "${filePath}";`);
  tag.name = cname;
  delete tag.attributes.is;
}

function escapeCodeContent(tag: MarkdocTag) {
  const isComponent = tag.name === 'Code';
  const code = isComponent ? tag.attributes.code : tag.children[0];

  if (typeof code === 'string') {
    if (isComponent) {
      tag.attributes.code = JSON.stringify(code);
    } else {
      tag.children[0] = htmlBlock(escapeHTML(code));
    }
  }
}

function escapeFenceContent(tag: MarkdocTag) {
  const isComponent = tag.name === 'Fence';
  const code = isComponent ? tag.attributes.code : tag.children[0];
  const highlightedCode = tag.attributes.highlightedCode;

  if (isComponent) {
    tag.attributes.code = JSON.stringify(code);

    if (highlightedCode) {
      tag.attributes.highlightedCode = JSON.stringify(highlightedCode);
    }
  } else {
    tag.children[0] = htmlBlock(code);
  }
}

function htmlBlock(html: string) {
  return `<div v-html="${JSON.stringify(html)}" style="display: contents;"></div>`;
}
