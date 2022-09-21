<script>
  export let error;
  export let reset;
</script>

<div class="error">
  <b class="title">Error</b>

  {#if error.stack}
    <pre class="stack">{error.stack}</pre>
  {/if}

  <button on:click={reset}>
    Loading this section failed. Click to try again.
  </button>
</div>

<style>
  .error {
    width: 100%;
    height: 100%;
    border: 2px solid red;
    padding: 1.5rem;
    font-family: monospace;
  }

  .error > * {
    margin-top: 0.75rem;
  }

  .title {
    font-size: 1.5rem;
  }

  .stack {
    font-family: monospace;
    padding: 1rem;
    color: red;
    overflow: auto;
    background: hsla(10, 50%, 50%, 0.1);
  }
</style>
