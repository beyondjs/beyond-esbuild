import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from '../main/App.vue';

export function render(label: string): Promise<string> {
  return renderToString(createSSRApp(App, { label }));
}
