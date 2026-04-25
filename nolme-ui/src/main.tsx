import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
// CopilotKit v2 stylesheet uses Tailwind v4 bare `@layer` syntax that Tailwind
// v3's PostCSS plugin can't parse. The file is excluded from Tailwind in
// postcss.config.js so this plain CSS import is safe.
import '@copilotkit/react-core/v2/styles.css';
import './styles/nolme-fonts.css';
import './styles/nolme-tokens.css';
import './styles/index.css';

const rootEl = document.getElementById('nolme-root');
if (!rootEl) {
  throw new Error('Nolme: #nolme-root not found in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
