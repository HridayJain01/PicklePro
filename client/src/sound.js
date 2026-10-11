// Draw audio: synthesized with Web Audio (no audio files), all routed through one master gain so
// muting silences everything instantly. Presentation only — nothing here touches the draw.
//
// Mobile rules this follows:
// - Browsers (iOS Safari, Android Chrome) only start audio inside a user gesture, so the
//   AudioContext is created/resumed and an unlock buffer is played inside the tap handler.
// - iPhone's ring/silent switch mutes Web Audio unless the page declares media playback
//   (navigator.audioSession, Safari 16.4+); we set it when available.
// - A saved "sound on" preference is only a wish: after a refresh the context is locked again,
//   so the UI shows "Tap to resume sound" until the next tap actually unlocks it.

const SOUND_KEY = 'team-draw:sound';
let ctx = null;
let master = null;
let wanted = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
})();
const listeners = new Set();
const timers = new Set(); // every scheduled sound timer, so mute can cancel them
const live = new Set(); // stop() functions of long-running sounds (reel, crowd, drumroll)

const running = () => Boolean(ctx && ctx.state === 'running');
export const soundStatus = () => (wanted ? (running() ? 'on' : 'locked') : 'off');
export const soundOn = () => soundStatus() === 'on';
const notify = () => listeners.forEach(fn => fn(soundStatus()));
export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function save() {
  try {
    localStorage.setItem(SOUND_KEY, wanted ? 'on' : 'off');
  } catch { /* storage unavailable */ }
}

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = wanted ? 1 : 0;
  // Gentle limiter so stacked effects never clip on phone speakers.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(ctx.destination);
  // iOS can suspend/interrupt the context (calls, Siri, backgrounding): keep the UI honest.
  ctx.onstatechange = notify;
  return ctx;
}

// Must be called from inside a tap/click handler.
async function unlock() {
  const a = ensureContext();
  if (!a) return false;
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* not supported */ }
  try {
    // A 1-sample silent buffer started in the gesture is what iOS needs to unlock output.
    const b = a.createBuffer(1, 1, a.sampleRate);
    const src = a.createBufferSource();
    src.buffer = b;
    src.connect(a.destination);
    src.start(0);
    if (a.state !== 'running') await a.resume();
  } catch {
    return false;
  }
  return a.state === 'running';
}

// Turn sound on/off from a tap. Returns the resulting status ('on' | 'off' | 'locked').
export async function setSound(on) {
  wanted = on;
  save();
  if (!on) {
    stopAll();
    if (master && ctx) master.gain.setValueAtTime(0, ctx.currentTime);
    notify();
    return 'off';
  }
  const ok = await unlock();
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(1, ctx.currentTime);
  }
  notify();
  return ok ? 'on' : 'locked';
}

// After a refresh with sound "on", the first tap anywhere on the page re-unlocks audio.
if (typeof window !== 'undefined') {
  const resumeOnGesture = () => {
    if (wanted && !running()) unlock().then(notify);
  };
  window.addEventListener('pointerdown', resumeOnGesture, { capture: true, passive: true });
  window.addEventListener('keydown', resumeOnGesture, { capture: true });
}

// Silence everything now: cancel scheduled sounds and stop long-running ones.
export function stopAll() {
  timers.forEach(clearTimeout);
  timers.clear();
  live.forEach(stop => stop());
  live.clear();
}

const later = (fn, ms) => {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
  return id;
};
const ready = () => (wanted && running() ? ctx : null);

function tone({ freq, to = freq, type = 'sine', ms = 120, gain = 0.2, delay = 0, attack = 0.004 }) {
  const a = ready();
  if (!a) return;
  const t = a.currentTime + delay / 1000;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.03);
}

let noise = null;
function noiseBuffer(a) {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}
// Filtered noise with an envelope [[ms, gain], ...]. Returns stop().
function noiseShape({ type = 'bandpass', freq = 800, q = 0.7, env, delay = 0 }) {
  const a = ready();
  if (!a) return () => {};
  const t = a.currentTime + delay / 1000;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (const [ms, v] of env) g.gain.linearRampToValueAtTime(v, t + ms / 1000);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + env.at(-1)[0] / 1000 + 0.05);
  return () => {
    try {
      g.gain.cancelScheduledValues(a.currentTime);
      g.gain.setTargetAtTime(0.0001, a.currentTime, 0.05);
      src.stop(a.currentTime + 0.3);
    } catch { /* already stopped */ }
  };
}
const track = stop => {
  live.add(stop);
  return () => {
    live.delete(stop);
    stop();
  };
};

// ---------- The slot machine (primary draw sound) ----------

// A continuous arcade reel "whirr" whose pitch and flutter follow the reel speed; below a few rows
// per second it adds a soft mechanical clunk as each name locks past the line. Returns a
// controller: setSpeed(rowsPerSecond), clunk(), stop().
export function slotReel() {
  const a = ready();
  if (!a) return { setSpeed() {}, clunk() {}, stop() {} };
  const t = a.currentTime;
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(0.16, t + 0.25);
  // Body: two detuned saws through a resonant band-pass — a bright arcade motor.
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3;
  bp.frequency.value = 900;
  const o1 = a.createOscillator();
  const o2 = a.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'square';
  o1.frequency.value = 110;
  o2.frequency.value = 165;
  o2.detune.value = 8;
  // Flutter: amplitude wobble at the row rate gives the "brrrr" of a spinning reel, not ticks.
  const trem = a.createGain();
  trem.gain.value = 0.6;
  const lfo = a.createOscillator();
  const lfoDepth = a.createGain();
  lfo.type = 'triangle';
  lfo.frequency.value = 14;
  lfoDepth.gain.value = 0.4;
  lfo.connect(lfoDepth).connect(trem.gain);
  o1.connect(bp);
  o2.connect(bp);
  bp.connect(trem).connect(out).connect(master);
  o1.start(t);
  o2.start(t);
  lfo.start(t);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      const n = a.currentTime;
      out.gain.cancelScheduledValues(n);
      out.gain.setTargetAtTime(0.0001, n, 0.06);
      [o1, o2, lfo].forEach(o => o.stop(n + 0.4));
    } catch { /* already stopped */ }
  };
  const untrack = track(stop);
  return {
    setSpeed(rps) {
      if (stopped) return;
      const n = a.currentTime;
      const s = Math.max(0, Math.min(1, rps / 14)); // 0 = stopped, 1 = full spin
      o1.frequency.setTargetAtTime(70 + 70 * s, n, 0.08);
      o2.frequency.setTargetAtTime(105 + 105 * s, n, 0.08);
      bp.frequency.setTargetAtTime(500 + 900 * s, n, 0.1);
      lfo.frequency.setTargetAtTime(Math.max(1.5, rps), n, 0.05);
      lfoDepth.gain.setTargetAtTime(0.3 + 0.35 * (1 - s), n, 0.1); // more "clack" as it slows
      out.gain.setTargetAtTime(0.05 + 0.11 * s, n, 0.1);
    },
    // A name locking past the line during the slow-down.
    clunk() {
      if (stopped) return;
      tone({ freq: 520, to: 260, type: 'triangle', ms: 70, gain: 0.12 });
      noiseShape({ type: 'highpass', freq: 2500, env: [[2, 0.05], [35, 0.0001]] });
    },
    stop: untrack,
  };
}

// The reel locks on the winner: a solid mechanical stop, then a bright jackpot bell run.
export function jackpot() {
  tone({ freq: 180, to: 90, type: 'square', ms: 120, gain: 0.18 });
  noiseShape({ type: 'lowpass', freq: 600, env: [[3, 0.25], [110, 0.0001]] });
  [1046, 1318, 1568, 2093].forEach((f, i) => {
    tone({ freq: f, type: 'triangle', ms: 420, gain: 0.11, delay: 130 + i * 90 });
    tone({ freq: f * 2, type: 'sine', ms: 300, gain: 0.03, delay: 130 + i * 90 });
  });
  // Coin sparkle.
  for (let i = 0; i < 8; i++) tone({ freq: 2400 + ((i * 337) % 900), type: 'sine', ms: 90, gain: 0.025, delay: 520 + i * 55 });
}

// Near-miss suspense: a quick rising "ohh" sting (reel passing / stalling by a name).
export function nearMiss() {
  tone({ freq: 330, to: 440, type: 'triangle', ms: 380, gain: 0.08 });
  tone({ freq: 415, to: 554, type: 'triangle', ms: 380, gain: 0.05 });
}

// ---------- Secondary effects ----------

// Subtle paddle-on-ball impact: short, soft, wooden. Throttled so impacts never stack.
let lastPock = 0;
export function pock() {
  const now = performance.now();
  if (now - lastPock < 600) return;
  lastPock = now;
  tone({ freq: 380, to: 190, type: 'triangle', ms: 55, gain: 0.07, attack: 0.002 });
  noiseShape({ type: 'bandpass', freq: 1600, q: 2, env: [[2, 0.04], [30, 0.0001]] });
}

// Countdown beeps: 3, 2, 1 low, then a high "go".
export const beep = go => tone({ freq: go ? 1320 : 660, type: 'square', ms: go ? 320 : 140, gain: 0.08 });

// Soft stadium murmur under the reel. Returns stop().
export const crowdSwell = ms => track(noiseShape({ freq: 650, q: 0.5, env: [[200, 0.02], [ms, 0.07], [ms + 4000, 0.07]] }));

export function cheer() {
  noiseShape({ freq: 1100, q: 0.4, env: [[60, 0.22], [700, 0.14], [2000, 0.0001]] });
}

export function fanfare() {
  [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', ms: 260, gain: 0.12, delay: i * 110 }));
}

// The whole-category shuffle: a quick cascade, one note per team dealt.
export function deal(count) {
  for (let i = 0; i < Math.min(count, 28); i++) later(() => tone({ freq: 500 + i * 22, type: 'triangle', ms: 70, gain: 0.06 }), i * 90);
}

// Snare roll for the last few names (replaces the rally). Returns stop().
export function drumroll(ms) {
  const ids = [];
  const hits = Math.floor(ms / 50);
  for (let i = 0; i < hits; i++) {
    const g = 0.02 + 0.08 * (i / hits);
    ids.push(later(() => noiseShape({ type: 'highpass', freq: 1800, env: [[3, g], [40, 0.0001]] }), i * 50));
  }
  return track(() => ids.forEach(id => { clearTimeout(id); timers.delete(id); }));
}

const JINGLES = {
  A: [[392, 0], [523, 140], [659, 280], [784, 420], [1047, 620]],
  WOMEN: [[659, 0], [784, 160], [988, 320], [1175, 480], [1319, 700]],
  B: [[440, 0], [554, 150], [659, 300], [880, 520]],
  C: [[349, 0], [440, 150], [523, 300], [698, 520]],
  D: [[330, 0], [415, 150], [494, 300], [659, 520]],
};
export function jingle(category) {
  for (const [f, d] of JINGLES[category] ?? JINGLES.B) {
    tone({ freq: f, type: 'square', ms: 170, gain: 0.05, delay: d });
    tone({ freq: f / 2, type: 'triangle', ms: 200, gain: 0.07, delay: d });
  }
}

// Referee whistle then a trophy fanfare: a category is locked in.
export function whistleAndTrophy() {
  [0, 260, 520].forEach((d, i) => tone({ freq: 2900, type: 'sine', ms: i === 2 ? 520 : 170, gain: 0.06, delay: d }));
  const notes = [[523, 0, 220], [523, 230, 120], [523, 360, 120], [698, 500, 700], [784, 1250, 260], [880, 1520, 260], [1047, 1800, 900]];
  for (const [f, d, ms] of notes) {
    tone({ freq: f, type: 'sawtooth', ms, gain: 0.04, delay: 1100 + d });
    tone({ freq: f / 2, type: 'triangle', ms, gain: 0.07, delay: 1100 + d });
  }
  later(cheer, 2600);
}

// A tiny pop for an emoji reaction.
export const plip = () => tone({ freq: 1400, to: 2100, type: 'sine', ms: 50, gain: 0.015 });

// Diagnostics (used by tests/QA): how many long-running sounds and scheduled sound timers exist.
export const activeSounds = () => ({ live: live.size, scheduled: timers.size, context: ctx?.state ?? 'none', status: soundStatus() });
