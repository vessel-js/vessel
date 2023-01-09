import type { HeadTag } from './manage-head';
import type { AttrValueResolver, ReactiveAttrValue } from './types/head-attrs';

export const HEAD_COUNT_KEY = `head:count`;
export const HEAD_ATTRS_KEY = `data-head-attrs`;
export const BODY_TAG_ATTR_NAME = `data-meta-body`;

export function updateHead(
  document = window.document,
  type: string,
  tags: HeadTag[],
  resolve: AttrValueResolver,
) {
  const head = document.head;
  const body = document.body;

  let headCountEl = head.querySelector(`meta[name="${HEAD_COUNT_KEY}"]`);

  const headCount = headCountEl ? Number(headCountEl.getAttribute('content')) : 0;

  const bodyMetaElements = body.querySelectorAll(`[${BODY_TAG_ATTR_NAME}]`);

  const oldHeadElements: Element[] = [];
  const oldBodyElements: Element[] = [];

  if (bodyMetaElements) {
    for (let i = 0; i < bodyMetaElements.length; i++) {
      if (bodyMetaElements[i] && bodyMetaElements[i].tagName?.toLowerCase() === type) {
        oldBodyElements.push(bodyMetaElements[i]);
      }
    }
  }

  if (headCountEl) {
    for (
      let i = 0, j = headCountEl.previousElementSibling;
      i < headCount;
      i++, j = j?.previousElementSibling || null
    ) {
      if (j?.tagName?.toLowerCase() === type) oldHeadElements.push(j);
    }
  } else {
    headCountEl = document.createElement('meta');
    headCountEl.setAttribute('name', HEAD_COUNT_KEY);
    headCountEl.setAttribute('content', '0');
    head.append(headCountEl);
  }

  let newElements = tags.map((tag) => ({
    element: createElement(tag.tag, tag.props, document, resolve),
    body: tag.props.body ?? false,
  }));

  newElements = newElements.filter((newEl) => {
    for (let i = 0; i < oldHeadElements.length; i++) {
      const oldEl = oldHeadElements[i];
      if (isEqualNode(oldEl, newEl.element)) {
        oldHeadElements.splice(i, 1);
        return false;
      }
    }

    for (let i = 0; i < oldBodyElements.length; i++) {
      const oldEl = oldBodyElements[i];
      if (isEqualNode(oldEl, newEl.element)) {
        oldBodyElements.splice(i, 1);
        return false;
      }
    }

    return true;
  });

  oldBodyElements.forEach((t) => t.parentNode?.removeChild(t));
  oldHeadElements.forEach((t) => t.parentNode?.removeChild(t));

  newElements.forEach((t) => {
    if (t.body === true) {
      body.insertAdjacentElement('beforeend', t.element);
    } else {
      head.insertBefore(t.element, headCountEl);
    }
  });

  headCountEl.setAttribute(
    'content',
    '' + (headCount - oldHeadElements.length + newElements.filter((t) => !t.body).length),
  );
}

function createElement(
  tag: string,
  attrs: Record<string, ReactiveAttrValue>,
  document: Document,
  resolve: AttrValueResolver,
) {
  const el = document.createElement(tag);

  for (const key of Object.keys(attrs)) {
    if (key === 'body' && attrs.body === true) {
      // set meta-body attribute to add the tag before </body>
      el.setAttribute(BODY_TAG_ATTR_NAME, 'true');
    } else {
      const value = resolve(attrs[key]);
      if (key === 'renderPriority' || key === 'key' || (!value && value !== 0 && value !== '')) {
        continue;
      } else if (key === 'children') {
        el.textContent = value + '';
      } else {
        el.setAttribute(key, value + '');
      }
    }
  }

  return el;
}

// Shamelessly taken from Next.js
function isEqualNode(oldTag: Element, newTag: Element) {
  if (oldTag instanceof HTMLElement && newTag instanceof HTMLElement) {
    const nonce = newTag.getAttribute('nonce');
    // Only strip the nonce if `oldTag` has had it stripped. An element's nonce attribute will not
    // be stripped if there is no content security policy response header that includes a nonce.
    if (nonce && !oldTag.getAttribute('nonce')) {
      const cloneTag = newTag.cloneNode(true) as typeof newTag;
      cloneTag.setAttribute('nonce', '');
      cloneTag.nonce = nonce;
      return nonce === oldTag.nonce && oldTag.isEqualNode(cloneTag);
    }
  }

  return oldTag.isEqualNode(newTag);
}
