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
