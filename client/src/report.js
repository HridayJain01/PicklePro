// Organizer PDF: every team as a card (team number, then one row per category: letter + player),
// in the same look as the app's team board. Built in the browser from the public state
// (already-revealed picks only), so it never shows a result early.
const PAGE_BG = [17, 48, 128];
const CARD = [11, 31, 82];
const WHITE = [255, 255, 255];
const MUTED = [170, 184, 214];
const YELLOW = [244, 224, 77];
const GREEN = [108, 192, 74];

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function downloadReport(state, { save = true } = {}) {
  let jsPDF;
  try {
    ({ jsPDF } = await import('jspdf'));
  } catch {
    throw new Error('The app was just updated. Refresh this page (pull down or press F5) and tap PDF report again.');
  }
  const logo = await loadImage('/logo.png');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); // 210
  const H = doc.internal.pageSize.getHeight(); // 297
  const cats = state.categories;
  const drawn = cats.reduce((n, c) => n + c.assigned, 0);
  const total = state.teamCount * cats.length;
  const status = state.status === 'COMPLETED' ? 'Final teams' : `In progress: ${drawn}/${total} picks`;

  // Layout: columns of cards like the phone board (3 across for the main draw, 2 for kids). Card height fits the number of categories.
  const M = 10;
  const GAP = 5;
  const HEADER = 30;
  const cols = state.teamCount > 8 ? 3 : 2;
  const cardW = (W - 2 * M - GAP * (cols - 1)) / cols;
  const lineH = 7;
  const cardH = 15 + cats.length * lineH + 3;
  const rowsPerPage = Math.max(1, Math.floor((H - HEADER - M + GAP) / (cardH + GAP)));
  const perPage = rowsPerPage * cols;

  const page = () => {
    doc.setFillColor(...PAGE_BG);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...CARD);
    doc.rect(0, 0, W, HEADER - 6, 'F');
    doc.setFillColor(...GREEN);
    doc.rect(0, HEADER - 6, W, 1.2, 'F');
    if (logo) doc.addImage(logo, 'PNG', M, 2.5, 19, 19);
    doc.setTextColor(...YELLOW);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('LIVE TEAM DRAW', M + 23, 9);
    doc.setTextColor(...WHITE);
    doc.setFontSize(16);
    doc.text(String(state.name ?? 'Team Draw').toUpperCase(), M + 23, 16.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(status, W - M, 16.5, { align: 'right' });
  };

  const card = (team, x, y) => {
    doc.setFillColor(...CARD);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(String(team.number), x + 6, y + 11);
    cats.forEach((c, i) => {
      const ly = y + 18.5 + i * lineH;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(c.short ?? c.label, x + 6, ly);
      const name = team.players[c.key];
      doc.setFontSize(11);
      doc.setTextColor(...(name ? WHITE : MUTED));
      const shown = name ?? '—';
      // Long names shrink to fit the card.
      const room = cardW - 21;
      let size = 11;
      while (size > 7 && doc.getStringUnitWidth(shown) * size / doc.internal.scaleFactor > room) size -= 0.5;
      doc.setFontSize(size);
      doc.text(shown, x + 18, ly);
    });
  };

  state.teams.forEach((team, i) => {
    const slot = i % perPage;
    if (slot === 0) {
      if (i > 0) doc.addPage();
      page();
    }
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    card(team, M + col * (cardW + GAP), HEADER + row * (cardH + GAP));
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${new Date().toLocaleString()}`, M, H - 4);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 4, { align: 'right' });
  }

  const file = `${String(state.name ?? '').replace(/[^\w -]+/g, '').trim() || 'team-draw'} - teams.pdf`;
  if (save) doc.save(file);
  return doc;
}
