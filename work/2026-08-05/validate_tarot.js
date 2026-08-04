const d = require('./tarot.json');
const cards = d.periods.daily;
const keys = Object.keys(cards);
console.log('count', keys.length);
const kws = new Set();
for (const k of keys) {
  const c = cards[k];
  if (kws.has(c.keyword)) console.log('DUP', k, c.keyword);
  kws.add(c.keyword);
  const n = c.lucky.number;
  const idx = parseInt(k, 10);
  if (n === 0 || Math.abs(n - idx) <= 1) console.log('BAD NUMBER', k, n);
  if (n < 1 || n > 45) console.log('OUT OF RANGE', k, n);
}
const scores = keys.map(k => cards[k].score);
console.log('scores', scores.join(','));
console.log('fives', scores.filter(s => s === 5).length);
console.log('lowones', scores.filter(s => s <= 2).length);
const numsHigh = keys.filter(k => cards[k].lucky.number >= 22).length;
console.log('numsHigh', numsHigh);
