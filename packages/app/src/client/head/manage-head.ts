/**
 * Credit: https://github.com/vueuse/head
 */

import { isFunction, isString } from 'shared/utils/unit';

import type {
  AttrValue,
  AttrValueResolver,
  HeadAttributes,
  Maybe,
  ReactiveAttrValue,
} from './types/head-attrs';
import type {
  HeadConfig,
  HeadConfigKeys,
  HeadTagInnerContent,
  HeadTagRenderDuplicate,
  HeadTagRenderLocation,
  HeadTagRenderPriority,
} from './types/head-config';
import { HEAD_ATTRS_KEY, updateHead } from './update-head';

const acceptedHeadFields: Set<HeadConfigKeys> = new Set([
  'title',
  'meta',
  'link',
  'base',
  'style',
  'script',
  'noscript',
  'htmlAttrs',
  'bodyAttrs',
]);

export type HeadTag = {
  tag: HeadConfigKeys;
  props: Record<string, ReactiveAttrValue> &
    HeadTagRenderPriority &
    HeadTagRenderDuplicate &
    HeadTagInnerContent &
    HeadTagRenderLocation;
};

export type HeadManager = {
  tags: HeadTag[];
  resolver: AttrValueResolver;
  add: (head: HeadConfig) => void;
  remove: (head: HeadConfig) => void;
  update: (document?: Document) => void;
};

export type CreateHeadManagerInit = {
  resolver: AttrValueResolver;
};

export function createHeadManager(
  init: CreateHeadManagerInit = { resolver: __resolver },
) {
  const { resolver: resolve } = init;
  const previousTags = new Set<string>();

  let records: HeadConfig[] = [];

  const manager: HeadManager = {
    get resolver() {
      return resolve;
    },

    get tags() {
      const deduped: HeadTag[] = [];

      const titleTemplate = records
        .map((record) => resolve(record?.titleTemplate))
        .reverse()
        .find((i) => i != null);

      records.forEach((record) => {
        const tags = flattenHeadTags(record);

        tags.forEach((tag) => {
          // Remove tags with the same key
          const dedupe = dedupeTags(tag, resolve);
          if (dedupe) {
            let index = -1;

            for (let i = 0; i < deduped.length; i++) {
              const prev = deduped[i];
              // only if the tags match
              if (prev.tag !== tag.tag) continue;
              // dedupe based on tag, for example <base>
              if (dedupe === true) index = i;
              // dedupe based on property key value, for example <meta name="description">
              else if (
                dedupe.propValue &&
                resolve(prev.props[dedupe.propValue]) ===
                  resolve(tag.props[dedupe.propValue])
              ) {
                index = i;
              }
              // dedupe based on property keys, for example <meta charset="utf-8">
              else if (
                dedupe.propKey &&
                prev.props[dedupe.propKey] &&
                tag.props[dedupe.propKey]
              ) {
                index = i;
              }

              if (index !== -1) break;
            }

            if (index !== -1) deduped.splice(index, 1);
          }

          if (titleTemplate && tag.tag === 'title') {
            tag.props.children = renderTitleTemplate(
              titleTemplate as string,
              tag.props.children,
              resolve,
            );
          }

          deduped.push(tag);
        });
      });

      return deduped;
    },

    add(head) {
      records.push(head);
    },

    remove(head) {
      records = records.filter((record) => record !== head);
    },

    update(document = window.document) {
      if (import.meta.env.SSR) return;

      let title: Maybe<string>;

      const htmlAttrs: HeadAttributes = {};
      const bodyAttrs: HeadAttributes = {};
      const liveTags: Record<string, HeadTag[]> = {};

      // head sorting here is not guaranteed to be honoured
      for (const tag of manager.tags.sort((a, b) => sortTags(a, b, resolve))) {
        if (tag.tag === 'title') {
          title = resolve(tag.props.children);
          continue;
        }

        if (tag.tag === 'htmlAttrs') {
          Object.assign(htmlAttrs, tag.props);
          continue;
        }

        if (tag.tag === 'bodyAttrs') {
          Object.assign(bodyAttrs, tag.props);
          continue;
        }

        liveTags[tag.tag] = liveTags[tag.tag] || [];
        liveTags[tag.tag].push(tag);
      }

      if (title) {
        document.title = title;
      }

      setAttrs(document.documentElement, htmlAttrs, resolve);
      setAttrs(document.body, bodyAttrs, resolve);

      const tags = new Set([...Object.keys(liveTags), ...previousTags]);

      for (const tag of tags) {
        updateHead(document, tag, liveTags[tag] || [], resolve);
      }

      previousTags.clear();
      Object.keys(liveTags).forEach((i) => previousTags.add(i));
    },
  };

  return manager;
}

function renderTitleTemplate(
  template: Required<HeadConfig>['titleTemplate'],
  title: ReactiveAttrValue<string> = null,
  resolve: AttrValueResolver,
): string | undefined | null {
  if (template == null) return '';

  if (isString(template)) {
    return template.replace('%s', resolve(title) ?? '');
  }

  return template ? resolve(template(resolve(title))) : null;
}

function flattenHeadTags(head: HeadConfig) {
  const tags: HeadTag[] = [];
  const keys = Object.keys(head) as Array<keyof HeadConfig>;

  for (const key of keys) {
    if (head[key] == null) continue;

    switch (key) {
      case 'title':
        tags.push({
          tag: key,
          props: { children: head[key] as string },
        });
        break;
      case 'titleTemplate':
        break;
      case 'base':
        tags.push({ tag: key, props: { key: 'default', ...head[key] } });
        break;
      default:
        if (acceptedHeadFields.has(key)) {
          const value = head[key];
          if (Array.isArray(value)) {
            value.forEach((item) => {
              tags.push({ tag: key, props: item });
            });
          } else if (value) {
            tags.push({ tag: key, props: value });
          }
        }

        break;
    }
  }

  return tags;
}

function setAttrs(
  el: Element,
  attrs: HeadAttributes,
  resolve: AttrValueResolver,
) {
  const existingAttrs = el.getAttribute(HEAD_ATTRS_KEY);

  if (existingAttrs) {
    for (const key of existingAttrs.split(',')) {
      if (!(key in attrs)) {
        el.removeAttribute(key);
      }
    }
  }

  const keys: string[] = [];

  for (const key in attrs) {
    const value = resolve(attrs[key]);

    if (!value && value !== 0 && value !== '') {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, value + '');
    }

    keys.push(key);
  }

  if (keys.length) {
    el.setAttribute(HEAD_ATTRS_KEY, keys.join(','));
  } else {
    el.removeAttribute(HEAD_ATTRS_KEY);
  }
}

export function sortTags(
  aTag: HeadTag,
  bTag: HeadTag,
  resolve: AttrValueResolver,
) {
  return computeTagWeight(aTag, resolve) - computeTagWeight(bTag, resolve);
}

function computeTagWeight(tag: HeadTag, resolve: AttrValueResolver) {
  if (tag.props.renderPriority) return tag.props.renderPriority;

  switch (tag.tag) {
    // This element must come before other elements with attribute values of URLs
    case 'base':
      return -1;
    case 'meta':
      // charset must come early in case there's non-utf8 characters in the HTML document
      if (resolve(tag.props.charset)) return -2;

      // CSP needs to be as-is since it effects the loading of assets
      if (resolve(tag.props['http-equiv']) === 'content-security-policy') {
        return 0;
      }

      return 10;
    default:
      // arbitrary safe number that can go up and down without conflicting
      return 10;
  }
}

function dedupeTags<T extends HeadTag>(tag: T, resolve: AttrValueResolver) {
  if (!['meta', 'base', 'script', 'link'].includes(tag.tag)) return false;

  const { props, tag: tagName } = tag;

  // must only be a single base so we always dedupe
  if (tagName === 'base') return true;

  // support only a single canonical
  if (tagName === 'link' && resolve(props.rel) === 'canonical') {
    return { propValue: 'canonical' };
  }

  // must only be a single charset
  if (resolve(props.charset)) return { propKey: 'charset' };

  const name = ['key', 'id', 'name', 'property', 'http-equiv'];
  const isHtmlElement = props instanceof HTMLElement;

  for (const n of name) {
    let value: Maybe<AttrValue> = null;

    if (isHtmlElement && props.hasAttribute(n)) {
      value = props.getAttribute(n);
    } else {
      value = resolve(props[n]);
    }

    if (value) return { propValue: n };
  }

  return false;
}

function __resolver<T extends AttrValue>(value: ReactiveAttrValue<T>) {
  const result = value && isFunction(value) ? (value as () => T)() : value;
  return result !== false ? result : null;
}
