import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';

export function configure(base: string) {
  setBasePath(base);
  return ['sl-button', 'sl-switch'].map(name => Boolean(customElements.get(name)));
}
