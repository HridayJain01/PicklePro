import '@fontsource-variable/archivo';
import '@fontsource-variable/big-shoulders';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Admin } from './Admin.jsx';
import { Live } from './Live.jsx';
import { Screen } from './Screen.jsx';
import { BASE } from './event.js';
import './styles.css';
import './audience.css';

const path = location.pathname.slice(BASE.length) || '/';
const Page = path.startsWith('/admin') ? Admin : path.startsWith('/screen') ? Screen : Live;
createRoot(document.getElementById('root')).render(<StrictMode><Page /></StrictMode>);
