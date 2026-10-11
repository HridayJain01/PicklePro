import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Announce } from './Audience.jsx';
import { verify } from './fair.js';
import * as fx from './fx.js';

const SPEED = 13; // rows per second at full spin: fast, but names stay readable
const VISIBLE = 3; // rows rendered either side of the centre line
const mod = (a, n) => ((a % n) + n) % n;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Slot-machine reel. Spins until the server's result arrives, then slows down so the winner
// stops exactly on the centre line. Purely visual: the winner is given, never chosen here.
//
// Every one-by-one spin ends with a deliberate near-miss, picked from the draw's id so every
// screen plays the same one: 'stall' creeps to one name short, then slides onto the winner;
// 'overshoot' slips just past the winner, then settles back onto it. Either way the reel ends
// on the server's winner — the tease only shapes the animation.
const TEASE_MS = 1300;
const teaseOf = actionId => {
  if (!actionId) return null;
  return parseInt(actionId.replace(/-/g, '').slice(0, 6), 16) % 2 ? 'overshoot' : 'stall';
};
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Performance: while the reel moves, React does not re-render. Each frame only sets a GPU
// transform on the list, and the 7 visible names are rewritten in place when a row passes.
function Reel({ names, phase, winner, onLanded, tease = null }) {
  const n = names.length;
  const start = Math.max(0, names.indexOf(winner));
  const motion = useRef({ pos: start, speed: 0 });
  const listRef = useRef(null);
  const rowRefs = useRef([]);
  const landed = useRef(onLanded);
  landed.current = onLanded;
  const [teasing, setTeasing] = useState(false);
  const moving = phase === 'spinning' || phase === 'landing';
  const reelSound = useSlotSound(moving, motion);

  // Draws position `p` straight into the DOM (no React render).
  const lastBase = useRef(null);
  const draw = p => {
    const b = Math.floor(p);
    if (b !== lastBase.current) {
      lastBase.current = b;
      rowRefs.current.forEach((li, i) => {
        if (li) li.textContent = names[mod(b + i - VISIBLE, n)] ?? '';
      });
    }
    if (listRef.current) listRef.current.style.transform = `translate3d(0, ${-(p - b) * 100}%, 0)`;
  };

  useEffect(() => {
    lastBase.current = null;
    draw(phase === 'done' && names.includes(winner) ? names.indexOf(winner) : motion.current.pos);
    if (!moving) return;
    const m = motion.current;
    const target = names.indexOf(winner);
    if (reducedMotion()) {
      if (phase === 'landing') {
        draw((m.pos = target));
        landed.current?.();
      }
      return;
    }
    let plan = null;
    let hold;
    let teaseTimer;
    if (phase === 'landing') {
      // Travel at least ~1.5 s worth of rows, then a long ease-out: the slow-down is the suspense.
      const base = Math.ceil(m.pos + SPEED * 1.5);
      const distance = base + mod(target - base, n) - m.pos;
      const kind = n > 2 ? tease : null;
      // 'stall' stops 0.55 rows short; 'overshoot' runs 0.4 rows past. Then the tease closes the gap.
      const offset = kind === 'stall' ? -0.55 : kind === 'overshoot' ? 0.4 : 0;
      plan = {
        from: m.pos,
        main: distance + offset,
        offset,
        ms: Math.min(5200, Math.max(3000, (3 * distance * 1000) / SPEED)),
        t0: performance.now(),
      };
      plan.total = plan.ms + (offset ? TEASE_MS : 0);
      if (offset) {
        teaseTimer = setTimeout(() => {
          setTeasing(true);
          fx.nearMiss();
        }, plan.ms - 150);
      }
      // A timer, not the frame loop, ends the reveal: frames pause in background tabs.
      hold = setTimeout(() => landed.current?.(), plan.total + 400);
    }
    let raf;
    let last = performance.now();
    let lastRow = Math.floor(m.pos + 0.5);
    let lastSpeedPush = 0;
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const before = m.pos;
      if (plan) {
        const elapsed = now - plan.t0;
        if (elapsed < plan.ms) {
          const t = elapsed / plan.ms;
          m.pos = plan.from + plan.main * (1 - (1 - t) ** 3);
        } else {
          const t = Math.min(1, (elapsed - plan.ms) / TEASE_MS);
          m.pos = plan.from + plan.main - plan.offset * easeInOut(t);
        }
      } else {
        m.pos += SPEED * dt;
      }
      // Speed drives the slot sound (pitch/flutter), pushed ~10x a second, not every frame.
      if (dt > 0) m.speed = m.speed * 0.8 + (Math.abs(m.pos - before) / dt) * 0.2;
      if (now - lastSpeedPush > 100) {
        reelSound.current?.setSpeed(m.speed);
        lastSpeedPush = now;
      }
      // Only in the slow part does each name "clunk" into place — no rapid ticking.
      const row = Math.floor(m.pos + 0.5);
      if (row !== lastRow && m.speed < 5) reelSound.current?.clunk();
      lastRow = row;
      draw(m.pos);
      if (!plan || now - plan.t0 < plan.total) raf = requestAnimationFrame(tick);
      else reelSound.current?.setSpeed(0);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hold);
      clearTimeout(teaseTimer);
    };
  }, [phase, names, winner, n, tease]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rows are fresh DOM nodes per phase (key), because the frame loop rewrites their text directly.
  const shown = phase === 'done' && names.includes(winner) ? names.indexOf(winner) : motion.current.pos;
  const base = Math.floor(shown);
  const rows = [];
  for (let k = -VISIBLE; k <= VISIBLE; k++) {
    rows.push(
      <li
        key={`${phase}${k}`}
        ref={el => { rowRefs.current[k + VISIBLE] = el; }}
        className={k === 0 && phase === 'done' ? 'winner' : undefined}
        style={{ transform: `translate3d(0, ${k * 100}%, 0)` }}
      >
        {names[mod(base + k, n)]}
      </li>,
    );
  }
  return (
    <div className={`machine machine-${phase}${teasing && phase === 'landing' ? ' machine-tease' : ''}`} aria-hidden="true">
      {moving && <Rally />}
      <Paddle side="left" />
      <div className={`reel reel-${phase}`}>
        <ul ref={listRef}>{rows}</ul>
        <span className="pointer pointer-left" />
        <span className="pointer pointer-right" />
      </div>
      <Paddle side="right" />
    </div>
  );
}

// The rally ball: horizontal glide (ease-in-out, paddle to paddle) and a separate vertical arc
// (rise decelerates, fall accelerates) on nested elements, so the path is a smooth parabola.
// Pure CSS transforms on the compositor; one bounce = 1.4 s, in step with the paddles and sound.
// The only ball sound: a soft paddle impact when the ball actually reaches a paddle (each
// direction change of the glide = animationiteration), never per frame.
function Rally() {
  return (
    <span className="rally">
      <span className="rally-x" onAnimationIteration={e => e.animationName === 'rally-x' && fx.pock()}>
        <span className="rally-y">
          <span className="rally-ball" />
        </span>
      </span>
    </span>
  );
}

// A real pickleball paddle (face, edge guard, throat, wrapped grip), coloured like the logo's.
function Paddle({ side }) {
  const id = `paddle-${side}`;
  const [light, dark] = side === 'left' ? ['#3d82e6', '#173f97'] : ['#8bd660', '#3f8a26'];
  return (
    <svg className={`paddle paddle-${side}`} viewBox="0 0 64 170" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      {/* handle + grip wrap */}
      <rect x="24" y="104" width="16" height="62" rx="6" fill="#1c2233" />
      {[112, 122, 132, 142, 152].map(y => <path key={y} d={`M24 ${y + 6} L40 ${y}`} stroke="#3a4560" strokeWidth="3" />)}
      <rect x="22" y="160" width="20" height="8" rx="3" fill="#0d1220" />
      {/* throat */}
      <path d="M22 100 Q32 112 42 100 L40 110 L24 110 Z" fill={dark} />
      {/* face with edge guard */}
      <rect x="3" y="3" width="58" height="102" rx="26" fill={`url(#${id})`} stroke="#0b1f52" strokeWidth="4" />
      <rect x="9" y="9" width="46" height="90" rx="21" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2" />
      <ellipse cx="22" cy="30" rx="9" ry="16" fill="#ffffff" opacity="0.18" />
    </svg>
  );
}

// Shows the sealed fingerprint while spinning, then checks it in this browser after the reveal.
function FairSeal({ show }) {
  const [verdict, setVerdict] = useState(null);
  const [open, setOpen] = useState(false);
  const done = show.phase === 'done';
  useEffect(() => {
    setVerdict(null);
    if (done) verify(show).then(setVerdict, () => setVerdict(null));
  }, [done, show]);
  if (!show.commitment) return null;
  const short = `${show.commitment.slice(0, 10)}…`;
  if (!done) return <p className="seal">🔒 Result sealed before the spin · <code>{short}</code></p>;
  if (verdict === null) return null;
  return (
    <div className={`seal seal-${verdict ? 'ok' : 'bad'}`}>
      <button type="button" className="seal-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {verdict ? '✅ Verified fair' : '⚠️ Verification failed'} · <code>{short}</code>
      </button>
      {open && (
        <div className="seal-detail">
          <p>Before the spin, the server published this fingerprint (SHA-256) of the result and a secret key. After the reveal it published the key, and this screen re-computed the fingerprint{verdict ? ' — it matches, so the result was fixed before the spin and could not be changed.' : ' — it does NOT match.'}</p>
          <p><b>Fingerprint</b> <code>{show.commitment}</code></p>
          <p><b>Key</b> <code>{show.salt}</code></p>
          <p><b>Checked text</b> <code>PicklePro|v1|{show.actionId}|{show.category}|…|key</code></p>
        </div>
      )}
    </div>
  );
}

// The slot-machine sound for one spin: starts when the reel starts moving (or when sound is
// switched on mid-spin), follows the reel speed via the returned ref, stops when it lands.
function useSlotSound(moving, motion) {
  const ref = useRef(null);
  useEffect(() => {
    if (!moving) return;
    const start = () => {
      if (!ref.current && fx.soundOn()) {
        ref.current = fx.slotReel();
        ref.current.setSpeed(motion.current.speed || SPEED);
      }
    };
    start();
    const off = fx.onSoundChange(status => {
      if (status === 'on') start();
      else {
        ref.current?.stop();
        ref.current = null;
      }
    });
    return () => {
      off();
      ref.current?.stop();
      ref.current = null;
    };
  }, [moving]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

// Under the reel: a soft crowd murmur, and a snare roll when only a few names are left.
// Both stop the moment the result lands (or immediately when sound is muted).
function useSpinSounds(show, phase) {
  const active = phase === 'spinning' || phase === 'landing';
  const few = Boolean(show && show.mode === 'spin' && show.candidates.length <= 3);
  const id = show?.actionId;
  useEffect(() => {
    if (!active) return;
    const stopCrowd = fx.crowdSwell(9000);
    const stopRoll = few ? fx.drumroll(12000) : () => {};
    return () => {
      stopCrowd();
      stopRoll();
    };
  }, [active, few, id]);
}

export const COUNTDOWN = 3;

// "3, 2, 1, GO!" over the machine before the reel moves. It only eats into the server's spin
// time (the result is still hidden on the server), so it never delays or changes the draw.
// Skipped for screens that joined mid-spin and for spins too short to fit it.
function useCountdown(show, spinMs) {
  const [count, setCount] = useState(null);
  const id = show?.live && show.phase !== 'done' && spinMs >= (COUNTDOWN + 1) * 1000 ? show.actionId : null;
  useEffect(() => {
    if (!id) return setCount(null);
    let n = COUNTDOWN;
    setCount(n);
    fx.beep(false);
    const timer = setInterval(() => {
      n -= 1;
      setCount(n);
      fx.beep(n === 0);
      if (n < 0) {
        clearInterval(timer);
        setCount(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [id]);
  return count === null || count < 0 ? null : count;
}

// The countdown, with every remaining name flashing past behind the number.
function Countdown({ count, names }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI(x => x + 1), 110);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="countdown" role="status" aria-live="assertive">
      {names.length > 0 && <span className="flyby" aria-hidden="true">{names[i % names.length]}</span>}
      <span key={count} className="countdown-num">{count === 0 ? 'Go!' : count}</span>
    </div>
  );
}

// Celebrate once per draw, and only when this screen watched it land (not on a page load).
function useCelebration(show, ref) {
  const watched = useRef(new Set());
  const celebrated = useRef(new Set());
  useEffect(() => {
    if (!show) return;
    if (show.phase !== 'done') {
      watched.current.add(show.actionId);
      return;
    }
    if (!watched.current.has(show.actionId) || celebrated.current.has(show.actionId)) return;
    celebrated.current.add(show.actionId);
    // The reel locking on the winner is the climax: jackpot bells (the shuffle deals cards instead).
    if (show.mode === 'shuffle') fx.deal(show.teamNumbers.length);
    else fx.jackpot();
    fx.cheer();
    // Feel the reveal even with sound off (Android; iPhones don't allow web vibration).
    navigator.vibrate?.(show.mode === 'shuffle' ? [40, 40, 40, 40, 160] : [50, 40, 140]);
    fx.confetti(ref.current);
  }, [show, ref]);
}

// Shows the real audio state: 'on' only when the browser has actually unlocked audio.
// 'locked' = sound was on before a refresh; the next tap (anywhere) resumes it.
function SoundToggle() {
  const [status, setStatus] = useState(fx.soundStatus);
  useEffect(() => fx.onSoundChange(setStatus), []);
  const toggle = async () => {
    // Runs inside the tap: required for iOS Safari / Android Chrome to allow audio.
    const next = await fx.setSound(status !== 'on');
    setStatus(next);
    if (next === 'on') fx.beep(true); // audible confirmation
  };
  const label = status === 'on' ? '🔊 Sound on' : status === 'locked' ? '🔈 Tap to resume sound' : '🔇 Tap for sound';
  return (
    <button type="button" className="btn btn-small sound-toggle" aria-pressed={status === 'on'} onClick={toggle}>
      {label}
    </button>
  );
}

function Fullscreen() {
  if (!document.fullscreenEnabled) return null;
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  return <button type="button" className="btn btn-small" onClick={toggle}>⛶ Full screen</button>;
}

export function StageTools() {
  return (
    <div className="stage-tools">
      <SoundToggle />
      <Fullscreen />
    </div>
  );
}

// The A shuffle reveal: every team's card flips in, one after another, like a dealer.
function Deal({ assignments }) {
  return (
    <ol className="deal">
      {assignments.map((a, i) => (
        <li key={a.teamNumber} style={{ animationDelay: `${i * 90}ms` }}>
          <span className="deal-team">{a.teamNumber}</span>
          <span className="deal-name">{a.name}</span>
        </li>
      ))}
    </ol>
  );
}

// The team's A player leads it: shown as captain while the rest of the team is drawn.
function Captain({ state, category, team }) {
  const hasA = state.categories.some(c => c.key === 'A');
  const name = hasA && category !== 'A' && team ? state.teams[team - 1]?.players.A : null;
  if (!name) return null;
  return <p className="captain">🏓 Captain <b>{name}</b></p>;
}

// When the last category's pick lands, the whole team is complete: show it as one card.
function TeamComplete({ state, show, winner, team }) {
  if (show.category !== state.categories.at(-1)?.key) return null;
  const players = { ...state.teams[team - 1]?.players, [show.category]: winner };
  return (
    <div className="team-complete">
      <p className="team-complete-title">Team {team} complete!</p>
      <ul>
        {state.categories.map(c => (
          <li key={c.key}><span>{c.label}</span><b>{players[c.key] ?? '—'}</b></li>
        ))}
      </ul>
    </div>
  );
}

// The fairness seal is for the host (and the Excel audit trail); audience screens hide it.
function StageView({ state, show, finish, children, big = false, announce = null, showSeal = false }) {
  const resultRef = useRef(null);
  const count = useCountdown(show, state?.spinMs ?? 0);
  // While counting down, the reel waits (even if the result already arrived) and then plays on.
  const phase = show && (count !== null ? 'countdown' : show.phase);
  useSpinSounds(show, phase);
  useCelebration(show, resultRef);
  const cls = big ? ' stage-big' : '';

  if (!state) {
    return (
      <section className="stage stage-quiet">
        <img className="stage-logo" src="/logo.png" alt="" />
        <p className="stage-title">Connecting…</p>
        <p className="stage-note">If the draw server was asleep it can take up to a minute to wake. Keep this page open.</p>
      </section>
    );
  }
  const label = key => state.categories.find(c => c.key === key)?.label ?? key;

  if (state.status === 'DRAFT') {
    return (
      <section className={`stage stage-quiet${cls}`}>
        <img className="stage-logo" src="/logo.png" alt="" />
        <p className="eyebrow">Coming up</p>
        <h2 className="stage-title">The draw starts soon</h2>
        <p className="stage-note">Keep this page open. It updates live, no refresh needed.</p>
        <StageTools />
        {children}
      </section>
    );
  }

  if (show) {
    const isShuffle = show.mode === 'shuffle';
    const first = show.teamNumbers[0];
    const lastTeam = show.teamNumbers.at(-1);
    const winner = show.assignments?.[0]?.name;
    const done = show.phase === 'done';
    return (
      <section className={`stage stage-live${done ? ' stage-done' : ''}${cls}`}>
        <Announce announce={announce} />
        <div className="stage-head">
          <p className="eyebrow">{label(show.category)} draw</p>
          <p className="eyebrow">{done ? show.candidates.length - show.teamNumbers.length : show.candidates.length} left</p>
        </div>
        <h2 className="stage-title">
          {isShuffle ? `Teams ${first}–${lastTeam}` : <>Team <span className="team-big">{first}</span></>}
        </h2>
        {!isShuffle && <Captain state={state} category={show.category} team={first} />}
        {!(done && isShuffle) && (
          <div className="machine-wrap">
            <Reel
              key={show.actionId}
              names={show.candidates}
              phase={phase === 'countdown' ? 'idle' : phase}
              winner={winner}
              tease={isShuffle ? null : teaseOf(show.actionId)}
              onLanded={() => finish(show.actionId)}
            />
            {phase === 'countdown' && <Countdown count={count} names={show.candidates} />}
          </div>
        )}
        <div className="result" aria-live="polite" ref={resultRef}>
          {!done && (
            <p className="stage-note suspense">
              {phase === 'countdown' ? 'Get ready…' : isShuffle ? 'Shuffling all players…' : phase === 'spinning' ? 'Rally in progress…' : 'Here it comes…'}
            </p>
          )}
          {done && !isShuffle && (
            <div className="winner-card">
              <span className="smash">Smash!</span>
              <strong className="winner-name">{winner}</strong>
              <span className="badge">→ Team {first}</span>
            </div>
          )}
          {done && !isShuffle && <TeamComplete state={state} show={show} winner={winner} team={first} />}
          {done && isShuffle && (
            <>
              <p className="result-line"><span className="badge">All {show.teamNumbers.length} teams have their {label(show.category)} player</span></p>
              {show.assignments && <Deal assignments={show.assignments} />}
            </>
          )}
        </div>
        {showSeal && <FairSeal show={show} />}
        <StageTools />
        {children}
      </section>
    );
  }

  const current = state.categories.find(c => c.key === state.current);
  const last = state.last && state.last.category === state.current ? state.last : null;
  return (
    <section className={`stage${cls}`}>
      <Announce announce={announce} />
      {state.status === 'COMPLETED' ? (
        <>
          <img className="stage-logo" src="/logo.png" alt="" />
          <p className="eyebrow">Final</p>
          <h2 className="stage-title">Draw complete</h2>
          <p className="stage-note">All {state.teamCount} teams are set. See every team below.</p>
        </>
      ) : (
        <>
          <div className="stage-head">
            <p className="eyebrow">{current?.label} draw</p>
            <p className="eyebrow">{state.remaining.length} left</p>
          </div>
          <h2 className="stage-title">
            {state.currentTeam
              ? (state.mode === 'shuffle' ? `Teams 1–${state.teamCount}` : <>Up next: Team <span className="team-big">{state.currentTeam}</span></>)
              : `All ${state.teamCount} teams filled`}
          </h2>
          {state.mode === 'spin' && <Captain state={state} category={state.current} team={state.currentTeam} />}
          {state.remaining.length > 0 && <Reel key={`idle-${state.current}`} names={state.remaining} phase="idle" />}
          <div className="result">
            {last && last.mode === 'spin' ? (
              <p className="stage-note">Last draw: <strong>{last.assignments[0].name}</strong> → Team {last.assignments[0].teamNumber}</p>
            ) : (
              <p className="stage-note">{state.currentTeam ? (state.mode === 'shuffle' ? 'Waiting for the host to shuffle.' : 'Waiting for the host to spin.') : `Waiting for the host to lock in ${current?.label}.`}</p>
            )}
          </div>
        </>
      )}
      <StageTools />
      {children}
    </section>
  );
}

// Memoised: the stage only re-renders when the draw, the spin or an announcement changes.
export const Stage = memo(StageView);
