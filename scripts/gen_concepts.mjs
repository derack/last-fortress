// gen_concepts.mjs — تولید تصاویر مرجع یکدست برای Hunyuan3D (image-to-3D)
// Usage: bun scripts/gen_concepts.mjs [id1 id2 ...]  (بدون آرگومان = همه)
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const STYLE =
  'stylized 3D game character, full body visible from head to toe, standing in neutral A-pose facing the camera, ' +
  'single character only, centered composition, plain solid light gray studio background, soft even studio lighting, ' +
  'clean stylized fantasy mobile game art style, slightly chunky readable proportions, crisp sculpted details, high quality render';

const CHARS = [
  // ---------- قهرمانان ----------
  { id: 'arman', desc: 'legendary knight commander hero in ornate golden and silver plate armor with a short red cape, holding a massive greatsword at his side, heroic stance' },
  { id: 'aria', desc: 'elven archer heroine in teal and silver leather armor, holding an elegant longbow in her left hand, long blonde ponytail' },
  { id: 'radin', desc: 'brave hero warrior in crimson and bronze armor, wielding a large battle axe resting on his shoulder, short dark hair, confident stance' },
  { id: 'nila', desc: 'young ice sorceress heroine in blue and white layered robes, holding a glowing frost crystal staff, silver hair' },
  // ---------- دشمنان ----------
  { id: 'shadow', desc: 'creepy shadow creature, dark wraith demon with glowing purple eyes and smoky ethereal body, clawed hands' },
  { id: 'warrior', desc: 'dark kingdom foot soldier in rusty iron armor with dented helmet, sword and round shield, evil grunt' },
  { id: 'golem', desc: 'massive stone golem made of mossy boulders with glowing orange lava cracks between the rocks, no visible mouth' },
  { id: 'spider', desc: 'menacing giant dark spider with purple markings, eight glowing red eyes, hairy legs' },
  { id: 'warlock', desc: 'evil warlock in dark hooded robes with green glow inside the hood, holding a skull-topped wooden staff' },
  { id: 'flyer', desc: 'small flying demon imp with leathery bat wings, dark red skin, small horns, floating pose' },
  { id: 'warMachine', desc: 'brutal fantasy siege war machine walker on iron legs, riveted dark metal plating, chains, cannon barrel arm' },
  { id: 'aetherTank', desc: 'armored aether-powered fantasy tank crawler with a glowing blue crystal energy core, dark bronze plates, small turret' },
  { id: 'smallDragon', desc: 'small fierce dark dragon with black scales, red wing membranes, curved horns, standing on hind legs' },
  { id: 'crystalMonster', desc: 'feral four-legged beast made of purple crystal shards with a glowing crystal core in its chest' },
  { id: 'hunter', desc: 'cunning dark elf hunter in dark green leather armor, hood, holding a crossbow, sharp ears' },
  { id: 'destroyer', desc: 'huge ogre brute warrior with heavy iron spiked armor, enormous war hammer dragging on the ground, gray skin' },
  { id: 'summoner', desc: 'necromancer summoner in tattered dark green robes, gaunt face, floating ghostly green skulls orbiting his staff' },
  { id: 'spirit', desc: 'ethereal ghost spirit, translucent pale blue wisp creature with flowing tail instead of legs, glowing white eyes' },
  { id: 'shadowSoldier', desc: 'shadow infantry soldier, black armored warrior with dark smoke aura, glowing violet visor, curved blade' },
  { id: 'annihilator', desc: 'heavy demolisher golem-bot with massive stone-metal fists, dark steel plating, glowing red furnace chest' },
  // ---------- باس‌ها ----------
  { id: 'golemKing', desc: 'colossal golem king with a carved stone crown, glowing amber runes on its rocky body, crystal shoulder guards' },
  { id: 'fireGiant', desc: 'enormous fire giant with molten lava skin, crown of flames, cracked obsidian armor plates' },
  { id: 'iceGiant', desc: 'giant frost juggernaut made of ice blocks and frozen iron armor, icy blue glow, frozen beard' },
  { id: 'blackDragon', desc: 'giant black dragon standing on all fours with spread wings, dark obsidian scales, glowing red eyes, long tail' },
  { id: 'darkLord', desc: 'terrifying dark lord with large curved horns, black ornate armor with purple cape, burning violet eyes' },
];

const outDir = 'scripts/concepts';
fs.mkdirSync(outDir, { recursive: true });

const wanted = process.argv.slice(2);
const list = wanted.length ? CHARS.filter((c) => wanted.includes(c.id)) : CHARS;

const zai = await ZAI.create();
let ok = 0, fail = 0;
for (const c of list) {
  const out = `${outDir}/${c.id}.png`;
  if (fs.existsSync(out) && fs.statSync(out).size > 30000) {
    console.log('skip (exists)', c.id);
    ok++;
    continue;
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await zai.images.generations.create({
        prompt: `${c.desc}, ${STYLE}`,
        size: '1024x1024',
      });
      const buf = Buffer.from(r.data[0].base64, 'base64');
      fs.writeFileSync(out, buf);
      console.log('OK', c.id, `${(buf.length / 1024).toFixed(0)}KB`);
      ok++;
      break;
    } catch (e) {
      console.error(`attempt${attempt} FAIL`, c.id, String(e).slice(0, 120));
      if (attempt === 2) fail++;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
console.log(`\nconcepts: ok=${ok} fail=${fail}`);
