// Which event this page belongs to. /kids, /kids/admin and /kids/screen are the kids draw;
// everything else is the main draw. Same app, separate tournaments and real-time rooms.
export const EVENT = /^\/kids(\/|$)/.test(location.pathname) ? 'kids' : 'main';
export const BASE = EVENT === 'kids' ? '/kids' : '';
export const API = `/api${BASE}`;
// Per-event browser storage keys, so the two draws never mix cached state or follows.
export const storeKey = name => (EVENT === 'kids' ? `team-draw:kids:${name}` : `team-draw:${name}`);
