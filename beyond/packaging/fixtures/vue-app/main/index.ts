import { createApp } from 'vue';
import App from './App.vue';

export function mount(element: Element, label: string) {
  return createApp(App, { label }).mount(element);
}
