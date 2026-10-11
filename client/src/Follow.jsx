import { useEffect, useMemo, useRef, useState } from 'react';
import { storeKey } from './event.js';
import * as fx from './fx.js';

const FOLLOW_KEY = storeKey('follow');
const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
const buzz = pattern => navigator.vibrate?.(pattern);
const initials = name => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Teams as this phone may show them: a pick still landing on the reel stays hidden (no spoilers).
export function visibleTeams(state, show) {
  if (!state) return [];
  const hidden = show && show.phase !== 'done' ? new Set(show.teamNumbers) : null;
  if (!hidden) return state.teams;
  return state.teams.map(t => (hidden.has(t.number) && t.players[show.category]
    ? { ...t, players: Object.fromEntries(Object.entries(t.players).filter(([k]) => k !== show.category)) }
    : t));
}

// Every name the phone can know about right now: drawn players plus the current category's pool.
function knownNames(state, teams) {
  const names = new Set(teams.flatMap(t => Object.values(t.players)));
  for (const n of state?.remaining ?? []) names.add(n);
  return [...names].sort((a, b) => a.localeCompare(b));
}

// ---------- 1. Follow your team ----------

export function useFollow(state, show) {
  const [name, setName] = useState(() => read(FOLLOW_KEY) ?? '');
  const teams = useMemo(() => visibleTeams(state, show), [state, show]);
  const team = name ? teams.find(t => Object.values(t.players).some(p => norm(p) === norm(name))) ?? null : null;
  const follow = n => {
    const v = n.trim().replace(/\s+/g, ' ');
    write(FOLLOW_KEY, v || null);
    setName(v);
  };
  return { name, team, teams, follow };
}

export function FollowCard({ state, follow }) {
  const { team, teams } = follow;
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState(null);
  const names = useMemo(() => knownNames(state, teams), [state, teams]);
  // Show the player's name as the organizers wrote it, whatever case was typed.
  const name = follow.name && (names.find(n => norm(n) === norm(follow.name)) ?? follow.name);

  // Buzz + pop-up when you get drawn, and when a teammate joins your team. Never on page load.
  const prev = useRef(undefined);
  const prevName = useRef(name);
  useEffect(() => {
    const now = team ? { number: team.number, names: Object.values(team.players) } : null;
    const before = prev.current;
    prev.current = now;
    // Starting (or changing) who you follow is silent; only later draws celebrate.
    const switched = prevName.current !== name;
    prevName.current = name;
    if (before === undefined || switched || !name) return;
    let msg = null;
    if (now && !before) {
      msg = { big: true, text: `You're in Team ${now.number}!` };
      buzz([80, 60, 80, 60, 220]);
      fx.fanfare();
      fx.confetti(document.querySelector('.follow-card'));
    } else if (now && before && now.number === before.number && now.names.length > before.names.length) {
      const joined = now.names.find(n => !before.names.includes(n));
      msg = { big: false, text: `New teammate: ${joined} joined Team ${now.number}!` };
      buzz([60, 40, 120]);
    }
    if (!msg) return;
    setToast({ ...msg, key: Date.now() });
    const timer = setTimeout(() => setToast(null), msg.big ? 5000 : 3500);
    return () => clearTimeout(timer);
  }, [team, name]);

  if (!state || state.status === 'DRAFT' && !name) return null;
  const filledCount = team ? state.categories.filter(c => team.players[c.key]).length : 0;
  const save = e => {
    e.preventDefault();
    if (!draft.trim()) return;
    follow.follow(draft);
    setDraft('');
    setEditing(false);
  };

  return (
    <section className="panel-card follow-card">
      {toast && <div key={toast.key} className={`follow-toast${toast.big ? ' big' : ''}`} role="status">{toast.big ? '🎉 ' : '🤝 '}{toast.text}</div>}
      <header className="panel-head">
        <span className="panel-icon">⭐</span>
        <div>
          <h3>{team ? `Know your team · Team ${team.number}` : 'Know your team'}</h3>
          <p>{name && !editing ? (team ? `${filledCount} of ${state.categories.length} players are in. The rest arrive live.` : `${name} isn’t drawn yet.`) : 'Playing today? Pick your name and meet your teammates the moment they are drawn.'}</p>
        </div>
      </header>

      {(!name || editing) ? (
        <form className="join" onSubmit={save}>
          <div className="join-row">
            <input list="follow-names" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type your name" aria-label="Your name" autoComplete="off" />
            <button className="btn btn-primary" disabled={!draft.trim()}>Follow</button>
          </div>
          <datalist id="follow-names">{names.map(n => <option key={n} value={n} />)}</datalist>
          {editing && <button type="button" className="link-btn" onClick={() => { follow.follow(''); setEditing(false); }}>Stop following</button>}
        </form>
      ) : (
        <>
          {team && (
            // The team as a chain of seats: filled seats show the player, empty seats wait with a
            // bell — the next teammate "lands" there live, with a buzz and pop-up for everyone
            // following this team.
            <ol className="team-chain">
              {state.categories.map(c => {
                const p = team.players[c.key];
                const me = p && norm(p) === norm(name);
                const now = !p && c.key === state.current;
                return (
                  <li key={c.key} className={[p ? 'filled' : 'empty', me && 'me', now && 'now'].filter(Boolean).join(' ')}>
                    <span className="seat-avatar" aria-hidden="true">{p ? initials(p) : now ? '🎰' : '🔔'}</span>
                    <span className="seat-role">{c.label}</span>
                    <b className="seat-name">{p ?? (now ? 'Being drawn now…' : 'Arriving soon')}</b>
                    {me && <span className="seat-you">You</span>}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="team-alert" role="note">
            <span className="team-alert-bell" aria-hidden="true">🔔</span>
            <span>
              {team
                ? <><b>Team alert is on.</b> Everyone following Team {team.number} gets a buzz and a pop-up the moment a new teammate is drawn{filledCount < state.categories.length ? '' : ' (your team is complete!)'}.</>
                : <><b>You’re on alert.</b> The moment {name} is drawn you’ll get a buzz and meet your team here — and your teammates will be notified about you too.</>}
            </span>
          </p>
          <div className="follow-actions">
            {team && <button type="button" className="btn btn-small" onClick={() => document.getElementById(`team-card-${team.number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Show on board</button>}
            <button type="button" className="link-btn" onClick={() => { setDraft(name); setEditing(true); }}>Change ({name})</button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- 2. Search the teams ----------

export function useTeamSearch(teams) {
  const [query, setQuery] = useState('');
  const q = norm(query);
  const found = q.length >= 2
    ? teams.filter(t => Object.values(t.players).some(p => norm(p).includes(q)))
    : [];
  // Stable Set (same teams -> same object) so the memoised board doesn't re-render while typing.
  const ids = found.map(t => t.number).join(',');
  const matches = useMemo(() => (q.length >= 2 ? new Set(ids ? ids.split(',').map(Number) : []) : null), [ids, q.length >= 2]); // eslint-disable-line react-hooks/exhaustive-deps
  return { query, setQuery, found, matches };
}

export function TeamSearch({ search }) {
  const { query, setQuery, found } = search;
  const go = n => document.getElementById(`team-card-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Jump to the first hit while typing.
  useEffect(() => {
    if (found.length) go(found[0].number);
  }, [found.length ? found[0].number : null]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="team-search">
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 Find a player's team…" aria-label="Find a player's team" />
      {query.trim().length >= 2 && (
        <p className="team-search-hits">
          {found.length
            ? found.slice(0, 6).map(t => <button type="button" key={t.number} onClick={() => go(t.number)}>Team {t.number}</button>)
            : <span>Not drawn yet</span>}
        </p>
      )}
    </div>
  );
}

// ---------- 5. Keep the screen awake while the draw is on ----------

export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || lock) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
        if (cancelled) lock.release();
      } catch { /* low battery mode or not allowed: the page still works */ }
    };
    acquire();
    // The lock drops whenever the tab is hidden; take it again when the viewer comes back.
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release();
    };
  }, [active]);
}
