// 왕짐 shop (C-023, user 2026-11-20): bought with stars, each purchase dearer; purchases survive merging two devices.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOP, buyItem, nextPrice, walletStars, spentStars, ensureMap } from '../cards/js/map.js';
import { mergeCards } from '../cards/js/sync.js';
import { newState } from '../cards/js/deck.js';

const withStars = (n) => { const s = newState('son'); ensureMap(s).stars = n; return s; };

test('SH1: each purchase costs more; the star total never drops, only what can be spent', () => {
  const s = withStars(SHOP.first + SHOP.first * SHOP.factor + 7);
  assert.equal(nextPrice(s), SHOP.first);
  assert.equal(buyItem(s, 'w-letter', '2026-11-20'), SHOP.first);
  assert.equal(nextPrice(s), SHOP.first * SHOP.factor);
  assert.equal(buyItem(s, 'w-goose', '2026-11-21'), SHOP.first * SHOP.factor);
  assert.equal(nextPrice(s), SHOP.first * SHOP.factor ** 2);
  assert.equal(s.map.stars, SHOP.first + SHOP.first * SHOP.factor + 7);   // colours and star gifts still see every star
  assert.equal(spentStars(s), SHOP.first + SHOP.first * SHOP.factor);
  assert.equal(walletStars(s), 7);
});

test('SH2: no purchase without enough stars, and an item is never bought twice', () => {
  const s = withStars(SHOP.first - 1);
  assert.equal(buyItem(s, 'w-letter', '2026-11-20'), 0);
  assert.equal(s.map.bought, undefined);                                 // the record keeps its shape until something is bought
  s.map.stars = SHOP.first * 10;
  assert.equal(buyItem(s, 'w-letter', '2026-11-20'), SHOP.first);
  assert.equal(buyItem(s, 'w-letter', '2026-11-21'), 0);
  assert.deepEqual(s.map.bought, { 'w-letter': { day: '2026-11-20', price: SHOP.first } });
});

test('SH3: merging two devices keeps every purchase; the same item keeps the earlier one; the wallet never goes below 0', () => {
  const a = withStars(SHOP.first), b = withStars(SHOP.first);
  buyItem(a, 'w-letter', '2026-11-20'); buyItem(b, 'w-goose', '2026-11-21');
  const m = mergeCards(a, b);
  assert.deepEqual(Object.keys(m.map.bought).sort(), ['w-goose', 'w-letter']);
  assert.equal(walletStars(m), 0);                                      // both spent the same stars while apart: 0, not negative
  const c = withStars(SHOP.first), d = withStars(SHOP.first);
  buyItem(c, 'w-letter', '2026-11-22'); buyItem(d, 'w-letter', '2026-11-20');
  assert.equal(mergeCards(c, d).map.bought['w-letter'].day, '2026-11-20');
  assert.equal(mergeCards(d, c).map.bought['w-letter'].day, '2026-11-20');
  assert.equal('bought' in mergeCards(withStars(3), withStars(4)).map, false);   // records without purchases keep their shape
});

test('SH4: a fixed-price item (effort hat or coat) does not raise the 왕짐 price', () => {
  const s = withStars(SHOP.first + 1500);
  assert.equal(buyItem(s, 'c023-hat-fish', '2026-11-20', 1500), 1500);
  assert.equal(nextPrice(s), SHOP.first);
  assert.equal(walletStars(s), SHOP.first);
  assert.equal(buyItem(s, 'w-letter', '2026-11-20'), SHOP.first);
  assert.equal(nextPrice(s), SHOP.first * SHOP.factor);
});
