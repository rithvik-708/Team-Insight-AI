import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { view } from '@forge/bridge';
import App from './App';
import './styles/app.css';

// Loads Atlassian design tokens (--ds-* CSS variables) so the UI follows Jira's light/dark theme.
view.theme.enable().catch(() => {
  // Outside Jira (local preview) the fallbacks in app.css apply.
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
