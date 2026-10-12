import '@fontsource-variable/archivo';
import '@fontsource-variable/big-shoulders';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Admin } from './Admin.jsx';
import { Live } from './Live.jsx';
import { Screen } from './Screen.jsx';
import { pagePath, useEvent } from './event.js';
import './styles.css';
import './audience.css';

// After a redeploy, an already-open tab asks for old file names (e.g. the PDF library) that no
// longer exist. Reload once to pick up the new version instead of failing silently.
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  try {
    if (sessionStorage.getItem('reloaded-for-update')) return;
    sessionStorage.setItem('reloaded-for-update', '1');
  } catch { /* storage blocked: reload anyway */ }
  window.location.reload();
});
window.addEventListener('load', () => setTimeout(() => { try { sessionStorage.removeItem('reloaded-for-update'); } catch { /* ignore */ } }, 10000));

const path = pagePath();
const Page = path.startsWith('/admin') ? Admin : path.startsWith('/screen') ? Screen : Live;

// Switching draws remounts the page (new live connection, fresh state) without a page reload,
// so the unlocked audio context survives and sound keeps working in either mode.
function App() {
  const ev = useEvent();
  return <Page key={ev} />;
}
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
