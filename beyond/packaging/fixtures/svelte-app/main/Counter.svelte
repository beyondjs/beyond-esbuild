<script>
  import { writable } from 'svelte/store';

  let { label } = $props();
  let count = $state(0);
  const history = writable([]);

  function increment() {
    count += 1;
    history.update(values => [...values, count]);
  }
</script>

<section class="panel">
  <p id="svelte-summary">{label}: {count}</p>
  <button id="svelte-increment" onclick={increment}>Increment</button>
  <p id="svelte-history">{$history.join(',')}</p>
</section>

<style>
  .panel { border-left: 4px solid rgb(255, 62, 0); padding-left: 12px; }
</style>
