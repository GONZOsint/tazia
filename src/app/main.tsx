import { createRoot } from 'react-dom/client';
import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';
import { ToastProvider } from '../components/ui/ToastHost';
import '../styles/index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <LocaleProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LocaleProvider>
  </ThemeProvider>
);

// Mono is caption/debug chrome — don't block first paint on two extra WOFF2s.
const warmMono = () => {
  void import('../styles/fonts-mono.css');
};
const w = window as Window &
  typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
if (typeof w.requestIdleCallback === 'function') {
  w.requestIdleCallback(warmMono, { timeout: 3000 });
} else {
  window.setTimeout(warmMono, 800);
}
