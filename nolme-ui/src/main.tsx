import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
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
