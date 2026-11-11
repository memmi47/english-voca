// Hand-drawn SVG art for the sample scene (own work, no external assets).
// Cards without scene art fall back to a system emoji from catalog pictures, then to text only.
const S = (inner) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
export const ART = {
  ghost: S(`<path d="M12 56V28C12 14 21 6 32 6s20 8 20 22v28l-6-6-7 6-7-6-7 6-7-6z" fill="#f4f6ff" stroke="#8d93b8" stroke-width="2"/><ellipse cx="25" cy="27" rx="3.5" ry="5" fill="#2b2d42"/><ellipse cx="39" cy="27" rx="3.5" ry="5" fill="#2b2d42"/><ellipse cx="32" cy="40" rx="4" ry="5" fill="#2b2d42"/>`),
  owl: S(`<path d="M10 8l9 8h26l9-8v30c0 12-10 18-22 18S10 50 10 38z" fill="#9b6b43" stroke="#5c3b21" stroke-width="2"/><circle cx="22" cy="28" r="9" fill="#fff6d6" stroke="#5c3b21" stroke-width="2"/><circle cx="42" cy="28" r="9" fill="#fff6d6" stroke="#5c3b21" stroke-width="2"/><circle cx="22" cy="28" r="4" fill="#222"/><circle cx="42" cy="28" r="4" fill="#222"/><path d="M28 34h8l-4 8z" fill="#f2a900"/><path d="M20 46q12 8 24 0" fill="none" stroke="#c99a6b" stroke-width="3"/><path d="M6 58h52" stroke="#5c3b21" stroke-width="4" stroke-linecap="round"/>`),
  shadow: S(`<rect x="4" y="4" width="56" height="56" rx="6" fill="#d9d6e8"/><path d="M30 14c5 0 8 4 8 8s-2 6-4 8c6 2 12 8 12 18v6H14v-6c0-10 6-16 12-18-2-2-4-4-4-8s3-8 8-8z" fill="#2a2740" opacity=".85"/>`),
  spider: S(`<g stroke="#2b2b2b" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M26 30L10 18l-4 6M26 34L8 36l-2 8M27 38L12 54M30 40L26 58M38 30l16-12 4 6M38 34l18 2 2 8M37 38l15 16M34 40l4 18"/></g><ellipse cx="32" cy="36" rx="9" ry="11" fill="#3b2f4a"/><circle cx="32" cy="24" r="6" fill="#3b2f4a"/><circle cx="30" cy="23" r="1.6" fill="#fff"/><circle cx="35" cy="23" r="1.6" fill="#fff"/>`),
  cobweb: S(`<rect x="2" y="2" width="60" height="60" rx="6" fill="#2d3250"/><g stroke="#e8ecff" stroke-width="1.6" fill="none"><path d="M4 4L60 60M4 4L60 28M4 4L28 60M4 4h56M4 4v56"/><path d="M14 4Q14 14 4 14M26 4Q26 26 4 26M40 4Q40 40 4 40M54 4Q54 54 4 54"/></g>`),
  crept: S(`<rect x="2" y="2" width="60" height="60" rx="6" fill="#efe9ff"/><g fill="#5b4b8a"><circle cx="30" cy="14" r="6"/><path d="M26 22l12 4 6 14-5 2-5-9-3 10 6 12-6 2-8-12 2-14z"/></g><g fill="#a89bd6"><ellipse cx="14" cy="54" rx="4" ry="2.5"/><ellipse cx="24" cy="57" rx="4" ry="2.5"/><ellipse cx="52" cy="50" rx="4" ry="2.5"/></g><path d="M8 40l6 3M8 46l6 0" stroke="#a89bd6" stroke-width="2" stroke-linecap="round"/>`),
  wind: S(`<rect x="2" y="2" width="60" height="60" rx="6" fill="#dff3ff"/><g fill="none" stroke="#5aa6d6" stroke-width="3" stroke-linecap="round"><path d="M6 22h32a7 7 0 1 0-7-7"/><path d="M6 34h44a7 7 0 1 1-7 7"/><path d="M6 46h22"/></g><path d="M46 12c6 0 8 6 4 10-6 0-8-6-4-10z" fill="#6bbf59"/>`),
  window: S(`<rect x="8" y="4" width="48" height="56" rx="3" fill="#2b3a67" stroke="#6d4c2f" stroke-width="4"/><path d="M32 4v56M8 32h48" stroke="#6d4c2f" stroke-width="3"/><circle cx="46" cy="16" r="6" fill="#fff3b0"/><path d="M8 4q10 18 4 56M56 4q-10 18-4 56" fill="none" stroke="#a23b5a" stroke-width="3" opacity=".7"/>`),
  chandelier: S(`<path d="M32 2v14" stroke="#7a6a3a" stroke-width="3"/><path d="M8 28q24 14 48 0" fill="none" stroke="#c9a227" stroke-width="4"/><path d="M32 16v12" stroke="#c9a227" stroke-width="3"/><g fill="#fff3b0" stroke="#c9a227" stroke-width="1.5"><rect x="8" y="14" width="4" height="12"/><rect x="30" y="8" width="4" height="10" fill="#ffe27a"/><rect x="52" y="14" width="4" height="12"/></g><g fill="#bfe9ff" stroke="#6aa9c9" stroke-width="1.5"><path d="M14 34l-3 8 3 6 3-6z"/><path d="M32 36l-3 9 3 8 3-8z"/><path d="M50 34l-3 8 3 6 3-6z"/><path d="M23 36l-2 6 2 4 2-4z"/><path d="M41 36l-2 6 2 4 2-4z"/></g>`),
};

export const SCENE_BG = {
  'haunted-house': `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2145"/><stop offset="1" stop-color="#4b3c78"/></linearGradient></defs><rect width="400" height="260" fill="url(#sky)"/><circle cx="330" cy="46" r="24" fill="#fff3b0"/><g fill="#14152c"><path d="M40 260V120l40-30 40 30v140z"/><path d="M110 260V70l50-40 50 40v190z"/><path d="M200 260V110l40-28 40 28v140z"/><rect x="60" y="60" width="10" height="40"/></g><g fill="#ffe27a" opacity=".9"><rect x="136" y="110" width="16" height="22"/><rect x="170" y="110" width="16" height="22"/><rect x="220" y="140" width="14" height="20"/></g><rect y="236" width="400" height="24" fill="#0d0e1f"/></svg>`,
};

// Resolve art for a card: scene mapping first, then emoji.
export function artFor(cardId, form, scene, catalog) {
  const id = scene?.items?.find((i) => i.card === cardId)?.art;
  if (id && ART[id]) return { kind: 'svg', html: ART[id] };
  const e = catalog.emoji(form);
  if (e) return { kind: 'emoji', html: e };
  return null;
}
