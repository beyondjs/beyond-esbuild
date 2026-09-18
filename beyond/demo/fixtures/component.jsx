import React from 'react';
import { createRoot } from 'react-dom/client';
import { main, answer, runs, __beyond_pkg } from '@fixture/app/main';
import { __beyond_pkg as shared } from '@fixture/shared/message';
import { styles } from '@beyond-js/kernel/styles';

/** Owns the interactive React view; the module's compiler/runtime values stay observable. */
class Component extends React.Component {
  #clicks = 0;
  #patched = false;

  render() {
    return <section className="content">
      <p className="label">React {React.version} · {this.props.format}</p>
      <h2 className="probe">{main()}</h2>
      <p>Four internal creators. One public module.</p>
      <output data-testid="answer">Beyond answer: {answer}</output>
      <output data-testid="runs">Internal counter: {runs}</output>
      <output data-testid="clicks">React updates: {this.#clicks}</output>
      <button data-testid="react" onClick={() => { this.#clicks++; this.forceUpdate(); }}>Update React state</button>
      <button data-testid="patch" disabled={this.#patched} onClick={async () => {
        await this.props.patch(); this.#patched = true; this.forceUpdate();
      }}>Apply Beyond patch</button>
    </section>;
  }
}

/** Adopts independently served module CSS through the real Kernel styles registry. */
class Demo {
  /** Load module-owned styles before mounting the component in its isolated root. */
  async run() {
    const format = new URL(location.href).searchParams.get('format') || 'esm';
    const root = document.querySelector('#app').attachShadow({ mode: 'open' });
    const control = document.querySelector('#shared').attachShadow({ mode: 'open' });
    const app = styles.register(__beyond_pkg.vspecifier);
    const dependency = styles.register(shared.vspecifier);
    await Promise.all([this.#adopt(root, app.href), this.#adopt(control, dependency.href)]);
    const container = document.createElement('div');
    root.append(container);
    const patch = () => format === 'system'
      ? System.import('/cdn/system/patch.js') : import('/cdn/esm/patch.js');
    createRoot(container).render(<Component format={format === 'esm' ? 'Native ESM' : 'SystemJS'} patch={patch} />);
    control.innerHTML += '<p class="probe">Shared module · independently scoped CSS</p>';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    globalThis.__demo = { ready: true, format, css: [app.href, dependency.href],
      identity: __beyond_pkg.vspecifier, react: React.version };
    document.querySelector('#status').textContent = 'Loaded and running';
  }

  #adopt(root, href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = href;
      link.onload = resolve; link.onerror = () => reject(new Error(`Could not load module CSS: ${href}`));
      root.append(link);
    });
  }
}

new Demo().run().catch(error => {
  document.querySelector('#status').textContent = error.message;
  globalThis.__demo = { ready: false, error: error.message };
  console.error(error);
});
