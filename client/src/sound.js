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
// Classic casino slot, synthesized (original, no samples): lever pull → fast "bleep-bloop"
// melody over a soft mechanical reel rattle, both slowing with the reel → reel thunk →
// ringing jackpot bells with a coin cascade.

// Lever pull: ratchet clicks winding up, then the clunk as the reels release.
export function leverPull() {
  for (let i = 0; i < 6; i++) {
    later(() => noiseShape({ type: 'bandpass', freq: 2200 + i * 120, q: 4, env: [[2, 0.07], [22, 0.0001]] }), i * 28);
  }
  later(() => {
    tone({ freq: 140, to: 70, type: 'square', ms: 140, gain: 0.16 });
    noiseShape({ type: 'lowpass', freq: 500, env: [[3, 0.18], [120, 0.0001]] });
  }, 190);
}

// Casino melody notes (C major arpeggio run up and down, like a slot's spin jingle).
const SLOT_NOTES = [523, 659, 784, 1047, 1319, 1047, 784, 659];

// Returns a controller: setSpeed(rowsPerSecond), clunk(), stop().
export function slotReel() {
  const a = ready();
  if (!a) return { setSpeed() {}, clunk() {}, stop() {} };
  leverPull();
  const t = a.currentTime;

  // Soft mechanical rattle under the melody: band-passed noise, amplitude-wobbled at the reel rate.
  const rattleSrc = a.createBufferSource();
  rattleSrc.buffer = noiseBuffer(a);
  rattleSrc.loop = true;
  const rattleBp = a.createBiquadFilter();
  rattleBp.type = 'bandpass';
  rattleBp.frequency.value = 1800;
  rattleBp.Q.value = 1.2;
  const rattle = a.createGain();
  rattle.gain.value = 0;
  const wob = a.createOscillator();
  const wobDepth = a.createGain();
  wob.type = 'square';
  wob.frequency.value = 20;
  wobDepth.gain.value = 0.02;
  wob.connect(wobDepth).connect(rattle.gain);
  const rattleOut = a.createGain();
  rattleOut.gain.setValueAtTime(0.0001, t);
  rattleOut.gain.linearRampToValueAtTime(1, t + 0.35);
  rattleSrc.connect(rattleBp).connect(rattle).connect(rattleOut).connect(master);
  rattleSrc.start(t + 0.2);
  wob.start(t + 0.2);

  // Melody: a look-ahead scheduler on the audio clock (sample-accurate, no setInterval jitter in
  // the notes themselves). Tempo follows the reel speed.
  let speed = 13;
  let nextAt = t + 0.25;
  let step = 0;
  let stopped = false;
  const schedule = () => {
    if (stopped) return;
    const notesPerSec = 4 + speed * 1.1; // ~18/s at full spin, a few per second when crawling
    while (nextAt < a.currentTime + 0.12) {
      const f = SLOT_NOTES[step % SLOT_NOTES.length];
      const at = nextAt;
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.045, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.min(0.09, 0.8 / notesPerSec));
      osc.connect(g).connect(master);
      osc.start(at);
      osc.stop(at + 0.1);
      step += 1;
      nextAt += 1 / notesPerSec;
    }
  };
  const timer = setInterval(schedule, 30);
  schedule();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    try {
      const n = a.currentTime;
      rattleOut.gain.cancelScheduledValues(n);
      rattleOut.gain.setTargetAtTime(0.0001, n, 0.04);
      rattleSrc.stop(n + 0.3);
      wob.stop(n + 0.3);
    } catch { /* already stopped */ }
  };
  const untrack = track(stop);
  return {
    setSpeed(rps) {
      if (stopped) return;
      speed = Math.max(0, rps);
      const n = a.currentTime;
      const s = Math.min(1, speed / 13);
      wob.frequency.setTargetAtTime(Math.max(2, speed * 1.6), n, 0.05);
      rattle.gain.setTargetAtTime(0.03 * s, n, 0.08);
      wobDepth.gain.setTargetAtTime(0.025 * s + 0.005, n, 0.08);
      rattleBp.frequency.setTargetAtTime(1200 + 900 * s, n, 0.1);
    },
    // A reel position clacking into place during the crawl.
    clunk() {
      if (stopped) return;
      tone({ freq: 300, to: 160, type: 'triangle', ms: 60, gain: 0.1 });
      noiseShape({ type: 'bandpass', freq: 2000, q: 3, env: [[2, 0.06], [30, 0.0001]] });
    },
    stop: untrack,
  };
}

// The reel stops on the winner: heavy thunk, then ringing jackpot bells and a coin cascade.
export function jackpot() {
  tone({ freq: 120, to: 60, type: 'square', ms: 160, gain: 0.2 });
  noiseShape({ type: 'lowpass', freq: 450, env: [[3, 0.22], [140, 0.0001]] });
  // Ringing bells: two bright pitches alternating fast, like a slot's win bell.
  for (let i = 0; i < 18; i++) {
    const f = i % 2 ? 2093 : 1760;
    later(() => {
      tone({ freq: f, type: 'triangle', ms: 160, gain: 0.07 });
      tone({ freq: f * 2.76, type: 'sine', ms: 110, gain: 0.02 }); // metallic overtone
    }, 180 + i * 75);
  }
  // Coins dropping into the tray: short metallic pings at slightly random times and pitches.
  for (let i = 0; i < 22; i++) {
    const f = 3000 + ((i * 523) % 1700);
    later(() => {
      tone({ freq: f, to: f * 0.92, type: 'sine', ms: 70, gain: 0.03 });
      tone({ freq: f * 1.5, type: 'sine', ms: 40, gain: 0.012 });
    }, 300 + i * 60 + ((i * 37) % 40));
  }
}

// Near-miss: the classic "so close" two-note slide before the reel settles.
export function nearMiss() {
  tone({ freq: 784, to: 740, type: 'square', ms: 180, gain: 0.04 });
  tone({ freq: 740, to: 698, type: 'square', ms: 260, gain: 0.04, delay: 190 });
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
