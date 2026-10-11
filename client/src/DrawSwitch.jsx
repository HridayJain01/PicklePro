import { useEffect, useState } from 'react';
import { EVENT, urlFor } from './event.js';

const DRAWS = [
  { key: 'main', label: 'Main draw', api: '/api/state' },
  { key: 'kids', label: 'Kids draw', api: '/api/kids/state' },
];

// One link for everyone: tabs to switch between the main and kids draws (different auction
// modes). Each tab shows that draw's live status; switching reloads the page in the other mode.
export function DrawSwitch() {
  const [status, setStatus] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () => Promise.all(DRAWS.map(d => fetch(d.api).then(r => r.json()).then(s => [d.key, s.status], () => [d.key, null])))
      .then(pairs => alive && setStatus(Object.fromEntries(pairs)));
    load();
    const timer = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <nav className="draw-switch" aria-label="Choose draw">
      {DRAWS.map(d => {
        const active = d.key === EVENT;
        const s = status[d.key];
        return (
          <a key={d.key} href={urlFor(d.key)} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
            {d.label}
            {s === 'LIVE' && <span className="draw-badge live">LIVE</span>}
            {s === 'COMPLETED' && <span className="draw-badge">Done</span>}
          </a>
        );
      })}
    </nav>
  );
}
