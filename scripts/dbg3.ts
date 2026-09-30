import { STAGES } from '../src/game/data/campaign';
let maxCount = 0, maxCountAt = '', totalEnemies = 0, minCount = 99;
const weird: string[] = [];
for (const lv of Object.values(STAGES)) {
  for (const [wi, w] of lv.waves.entries()) {
    for (const g of w.groups) {
      totalEnemies += g.count;
      if (g.count > maxCount) { maxCount = g.count; maxCountAt = `${lv.id} w${wi + 1} ${g.enemy}`; }
      if (g.count < minCount) minCount = g.count;
      if (!Number.isFinite(g.tier) || g.tier < 1) weird.push(`${lv.id} tier=${g.tier}`);
    }
  }
}
console.log('totalEnemies(100 stages)=', totalEnemies, '| maxCount=', maxCount, 'at', maxCountAt, '| minCount=', minCount, '| weird:', weird.length ? weird : 'none');
// نمونه: c1s1 موج اول و Boss آخر
const s1 = STAGES['c1s1'], s100 = STAGES['c10s10'];
console.log('c1s1 w1:', JSON.stringify(s1.waves[0].groups.map(g => `${g.enemy}×${g.count} T${g.tier}`)));
console.log('c1s1 waves10:', JSON.stringify(s1.waves[9].groups.map(g => `${g.enemy}×${g.count} T${g.tier}`)));
console.log('c10s10 boss:', JSON.stringify(s100.waves[9].groups.map(g => `${g.enemy}×${g.count} T${g.tier}`)));
console.log('c1s1 startCoins', s1.startCoins, '| c10s10 startCoins', s100.startCoins);
