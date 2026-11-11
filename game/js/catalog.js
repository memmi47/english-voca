// Read-only view over catalog.json plus parent-registered local cards.
export class Catalog {
  constructor(data, localCards = {}, pictures = null) {
    this.cards = data.cards; this.pictures = pictures || data.pictures || {}; this.local = localCards;
  }
  with(localCards) { return new Catalog({ cards: this.cards, pictures: this.pictures }, localCards); }
  card(id) {
    const c = this.cards[id];
    if (c) return { id, form: c.f, lemma: c.l, meaning: c.m, depth: c.d, imageType: c.i, track: c.k, kind: c.kd, ipa: c.ipa, ko: c.ko };
    const l = this.local[id];
    if (l) return { id, form: l.card_form, lemma: l.lemma_link || id, meaning: l.single_meaning_ko, depth: l.depth_target || 3,
      imageType: l.image_type || '구체명사', track: l.track || 'vocab', kind: l.kind || '본문 표기', ipa: l.ipa_us || '', ko: l.pronunciation_ko || '', local: true };
    return null;
  }
  // 'chosen' emoji fallback; scene art is resolved by the UI layer.
  emoji(form) { return this.pictures[String(form).toLowerCase()] || null; }
}
