const React = require('./react.cjs');
const server = require('./react-dom-server.cjs');
const { jsx } = require('react/jsx-runtime');
const Component = () => {
  const [value] = React.useState('Beyond ESBuild');
  return jsx('section', { 'data-build': 'fork', children: value });
};
console.log(JSON.stringify({version: React.version, same: React === require('react'),
  html: server.renderToString(React.createElement(Component)), files: Object.keys(require.cache)}));
