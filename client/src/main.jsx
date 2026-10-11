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

const path = pagePath();
const Page = path.startsWith('/admin') ? Admin : path.startsWith('/screen') ? Screen : Live;

// Switching draws remounts the page (new live connection, fresh state) without a page reload,
// so the unlocked audio context survives and sound keeps working in either mode.
function App() {
  const ev = useEvent();
  return <Page key={ev} />;
}
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
