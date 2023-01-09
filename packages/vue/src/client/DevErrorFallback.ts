import { defineComponent, h } from 'vue';

export default /*#__PURE__*/ defineComponent<{
  error: Error;
  reset: () => void;
}>({
  name: 'DevErrorFallback',
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'error',
          style: 'border: 2px solid red; padding: 1.5rem; font-family: monospace;',
        },
        [
          h('b', { class: 'title', style: 'font-size: 1.5rem;' }, 'Error'),
          props.error.stack &&
            h(
              'pre',
              {
                class: 'stack',
                style:
                  'padding: 1rem; color: red; overflow: auto; background: hsla(10, 50%, 50%, 0.1);',
              },
              props.error.stack,
            ),
          h(
            'button',
            { onClick: () => props.reset() },
            'Loading this section failed. Click to try again.',
          ),
        ],
      );
  },
});
