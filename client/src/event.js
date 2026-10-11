// Which draw this page shows. One link for everyone: the in-page switch adds ?draw=kids
// (older /kids, /kids/admin links still work). Same app, separate tournaments and live rooms.
const params = new URLSearchParams(location.search);
export const EVENT = /^\/kids(\/|$)/.test(location.pathname) || params.get('draw') === 'kids' ? 'kids' : 'main';
// Path prefix of the old /kids links, so the page router can strip it.
export const BASE = /^\/kids(\/|$)/.test(location.pathname) ? '/kids' : '';
export const API = EVENT === 'kids' ? '/api/kids' : '/api';
// Per-event browser storage keys, so the two draws never mix cached state or follows.
export const storeKey = name => (EVENT === 'kids' ? `team-draw:kids:${name}` : `team-draw:${name}`);
// Same page (audience / admin / screen), other draw.
export function urlFor(ev) {
  const page = location.pathname.replace(/^\/kids/, '') || '/';
  return ev === 'kids' ? `${page}?draw=kids` : page;
}
export const pageUrl = page => (EVENT === 'kids' ? `${page}?draw=kids` : page);
