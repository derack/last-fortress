import { STAGES, CHAPTERS, buildStage } from '../src/game/data/campaign';
import { ENEMIES, tiered } from '../src/game/data/enemies';
// بازسازی همان محاسبه buildAllStages برای دیدن comp
function income0(ch: number, s: number) {
  const lv = buildStage(CHAPTERS[ch-1], s, 1);
  let kill = 0, bonus = 0;
  for (const w of lv.waves) { bonus += w.coinBonus ?? 0; for (const g of w.groups) kill += g.count * tiered(ENEMIES[g.enemy], g.tier).reward; }
  return { start: lv.startCoins, kill: Math.round(kill), bonus, total: lv.startCoins + kill + bonus };
}
const ref = Array.from({length:10},(_,i)=>income0(1,i+1).total).reduce((a,b)=>a+b,0)/10;
console.log('ref(ch1 avg total income)=', Math.round(ref));
for (const id of ['c3s3','c3s4','c3s5','c3s6','c1s5']) {
  const [c, s] = id.match(/c(\d)s(\d+)/)!.slice(1,3).map(Number);
  const D = (c-1)*10+s;
  const inc = income0(c, s);
  const target = ref * Math.pow(1.0117, D-1);
  const comp = Math.min(2.0, Math.max(0.6, target/inc.total));
  console.log(id, 'D'+D, 'income0', inc.total, `(${inc.start}+${inc.kill}+${inc.bonus})`, 'target', Math.round(target), 'comp', comp.toFixed(2));
}
// درآمد نهایی c3s4 و c3s5 پس از comp
for (const id of ['c3s4','c3s5'] as const) {
  const lv = STAGES[id];
  let bonus = 0, kill = 0;
  for (const w of lv.waves) { bonus += w.coinBonus ?? 0; for (const g of w.groups) kill += g.count * tiered(ENEMIES[g.enemy], g.tier).reward; }
  console.log(id, 'FINAL income', lv.startCoins + kill + bonus, '(bonus', bonus, 'kill', kill, ')');
}
