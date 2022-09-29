/**
 * Adapted from: https://github.com/vueuse/head
 */

import { type HeadManager, type HeadTag, sortTags } from './manage-head';
import type {
  AttrValueResolver,
  HeadAttributes,
  ReactiveAttrValue,
} from './types/head-attrs';
import {
  BODY_TAG_ATTR_NAME,
  HEAD_ATTRS_KEY,
  HEAD_COUNT_KEY,
} from './update-head';

const SELF_CLOSING_TAGS = ['meta', 'link', 'base'];

type SSRHeadResult = {
  /** Tags in `<head>` */
  readonly head: string;
  /** Attributes for `<html>` */
  readonly htmlAttrs: string;
  /** Attributes for `<body>` */
  readonly bodyAttrs: string;
  /** Tags in `<body>` */
  readonly body: string;
};

export function renderHeadToString(manager: HeadManager): SSRHeadResult {
  const tags: string[] = [];
  const htmlAttrs: HeadAttributes = {};
  const bodyAttrs: HeadAttributes = {};
  const bodyTags: string[] = [];
  const resolver = manager.resolver;

  let titleTag = '';
  for (const tag of manager.tags.sort((a, b) => sortTags(a, b, resolver))) {
    if (tag.tag === 'title') {
      titleTag = tagToString(tag, resolver);
    } else if (tag.tag === 'htmlAttrs') {
      Object.assign(htmlAttrs, tag.props);
    } else if (tag.tag === 'bodyAttrs') {
      Object.assign(bodyAttrs, tag.props);
    } else if (tag.props.body) {
      bodyTags.push(tagToString(tag, resolver));
    } else {
      tags.push(tagToString(tag, resolver));
    }
  }

  tags.push(`<meta name="${HEAD_COUNT_KEY}" content="${tags.length}">`);

  return {
    get head() {
      return titleTag + tags.join('');
    },
    get htmlAttrs() {
      return stringifyAttrs(
        {
          ...htmlAttrs,
          [HEAD_ATTRS_KEY]: Object.keys(htmlAttrs).join(','),
        },
        resolver,
      );
    },
    get bodyAttrs() {
      return stringifyAttrs(
        {
          ...bodyAttrs,
          [HEAD_ATTRS_KEY]: Object.keys(bodyAttrs).join(','),
        },
        resolver,
      );
    },
    get body() {
      return bodyTags.join('');
    },
  };
}

function tagToString(tag: HeadTag, resolve: AttrValueResolver) {
  let isBodyTag = false;

  if (tag.props.body) {
    isBodyTag = true;
    // avoid rendering body attr
    delete tag.props.body;
  }

  if (tag.props.renderPriority) {
    delete tag.props.renderPriority;
  }

  const attrs = stringifyAttrs(tag.props, resolve);
  if (SELF_CLOSING_TAGS.includes(tag.tag)) {
    return `<${tag.tag}${attrs}${
      isBodyTag ? ' ' + ` ${BODY_TAG_ATTR_NAME}="true"` : ''
    }>`;
  }

  return `<${tag.tag}${attrs}${
    isBodyTag ? ` ${BODY_TAG_ATTR_NAME}="true"` : ''
  }>${resolve(tag.props.children) || ''}</${tag.tag}>`;
}

function stringifyAttrs(
  attributes: Record<string, ReactiveAttrValue>,
  resolve: AttrValueResolver,
) {
  const handledAttributes: string[] = [];

  for (const [key, _value] of Object.entries(attributes)) {
    const value = resolve(_value);

    if (key === 'children' || key === 'key') {
      continue;
    }

    if (!value && value !== 0 && value !== '') {
      continue;
    }

    let attribute = htmlEscape(key);
    attribute += `="${htmlEscape(value + '')}"`;

    handledAttributes.push(attribute);
  }

  return handledAttributes.length > 0 ? ' ' + handledAttributes.join(' ') : '';
}

// MIT licensed: modified from https://github.com/sindresorhus/stringify-attributes/blob/6e437781d684d9e61a6979a8dd2407a81dd3f4ed/index.js
function htmlEscape(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
