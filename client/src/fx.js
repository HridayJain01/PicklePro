// Visual effects (confetti). Sounds live in sound.js and are re-exported for existing imports.
export * from './sound.js';

const COLORS = ['#1f5fc6', '#6cc04a', '#f4e04d', '#ffffff', '#0f2a6b'];
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Confetti + pickleballs from a point on screen. Self-cleaning canvas, ~2.5 s.
export function confetti(originEl) {
  if (reducedMotion()) return;
  const rect = originEl?.getBoundingClientRect() ?? { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.append(canvas);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const ox = rect.left + rect.width / 2;
  const oy = rect.top + rect.height / 2;
  const bits = Array.from({ length: 140 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      size: 5 + Math.random() * 7,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[i % COLORS.length],
      ball: i % 12 === 0,
    };
  });
  const t0 = performance.now();
  const frame = now => {
    const life = (now - t0) / 2500;
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalAlpha = Math.max(0, 1 - life ** 3);
    for (const b of bits) {
      b.vy += 0.35;
      b.vx *= 0.985;
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.vr;
      if (b.ball) {
        g.fillStyle = '#f4e04d';
        g.beginPath();
        g.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#0f2a6b';
        for (const [dx, dy] of [[-0.35, -0.3], [0.3, -0.25], [0, 0.35]]) {
          g.beginPath();
          g.arc(b.x + dx * b.size, b.y + dy * b.size, b.size * 0.16, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.rot);
        g.fillStyle = b.color;
        g.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        g.restore();
      }
    }
    if (life < 1) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
