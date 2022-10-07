function DevErrorFallback(props) {
  return (
    <div
      class="error"
      style="border: 2px solid red; padding: 1.5rem; font-family: monospace;"
    >
      <b class="title" style="font-size: 1.5rem;">
        Error
      </b>

      {props.error.stack && (
        <pre
          class="stack"
          style="padding: 1rem; color: red; overflow: auto; background: hsla(10, 50%, 50%, 0.1);"
        >
          {props.error.stack}
        </pre>
      )}

      <button onClick={props.reset}>
        Loading this section failed. Click to try again.
      </button>
    </div>
  );
}

export default DevErrorFallback;
