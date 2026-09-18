import { mount } from 'svelte';
import Counter from './Counter.svelte';

export function start(target, label) {
  return mount(Counter, { target, props: { label } });
}
