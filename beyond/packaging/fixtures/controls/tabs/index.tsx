import { createRoot } from 'react-dom/client';
import * as Tabs from '@radix-ui/react-tabs';

function Panel() {
  return (
    <Tabs.Root defaultValue="account">
      <Tabs.List aria-label="Settings">
        <Tabs.Trigger id="tab-account" value="account">Account</Tabs.Trigger>
        <Tabs.Trigger id="tab-password" value="password">Password</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content id="panel-account" value="account">Account settings</Tabs.Content>
      <Tabs.Content id="panel-password" value="password">Password settings</Tabs.Content>
    </Tabs.Root>
  );
}

export function mount(element: Element) {
  const root = createRoot(element);
  root.render(<Panel />);
  return root;
}
