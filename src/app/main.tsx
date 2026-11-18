import { createRoot } from 'react-dom/client';
import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';
import '../styles/index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </ThemeProvider>
);
