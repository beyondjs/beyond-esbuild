import { render } from 'svelte/server';
import Counter from '../main/Counter.svelte';

export function html(label) {
  return render(Counter, { props: { label } }).body;
}
