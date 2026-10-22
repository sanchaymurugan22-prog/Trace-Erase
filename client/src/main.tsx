import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from '@/lib/router';
import { I18nProvider } from '@/i18n/I18nProvider';
import { SessionProvider } from '@/lib/session';
import { ToastProvider } from '@/components/ui';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <I18nProvider>
        <SessionProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SessionProvider>
      </I18nProvider>
    </Router>
  </StrictMode>
);
