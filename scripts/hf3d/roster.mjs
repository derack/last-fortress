// Roster of all models to generate via Hunyuan3D (image-to-3D)
// style suffix keeps visual consistency across the whole roster

export const CHAR_STYLE =
  'stylized fantasy mobile game character, vibrant colors, clean readable silhouette, full body visible head to feet, standing neutral pose facing camera, single character only, light gray studio background, soft even lighting, three-quarter view, high quality game asset render, no text, no watermark';

export const TOWER_STYLE =
  'stylized fantasy mobile game tower, vibrant colors, clean readable silhouette, whole structure visible including base, single tower only, no characters, light gray studio background, soft even lighting, three-quarter view from slightly above, high quality game asset render, no text, no watermark';

export const ROSTER = [
  // ---------------- heroes (4) ----------------
  { id: 'arman', kind: 'char', desc: 'heroic human commander in ornate lapis-lazuli and bronze plate armor, short dark beard, flowing blue cape, holding a massive glowing storm war-hammer crackling with electric arcs, small aegis shield strapped on left arm' },
  { id: 'aria', kind: 'char', desc: 'female fire sorceress guardian, elegant crimson and gold layered robes, floating ember orbs swirling around her raised hand, ornate bronze staff topped with a burning crystal, warm glowing eyes' },
  { id: 'radin', kind: 'char', desc: 'heavy armored dwarf-like warrior tank, bulky riveted steel plate armor with bronze trim, giant two-handed iron pick-hammer resting on shoulder, thick brown beard with metal rings, sturdy stance' },
  { id: 'nila', kind: 'char', desc: 'agile female mystic archer, teal and violet leather armor with glowing rune trims, deep hood, drawing a curved bow of glowing cyan energy, slim graceful build, quiver on back' },

  // ---------------- enemies (16) ----------------
  { id: 'shadow', kind: 'char', desc: 'creepy shadow creature, wispy pitch-black smoky humanoid with long arms, two glowing purple eyes, edges dissolving into smoke wisps' },
  { id: 'warrior', kind: 'char', desc: 'dark evil warrior, blackened iron armor with spikes, tattered dark red cloak, rusty notched sword, menacing round spiked shield' },
  { id: 'golem', kind: 'char', desc: 'massive stone golem, humanoid body built of cracked granite boulders, glowing amber energy core in chest, small moss patches, heavy fists' },
  { id: 'spider', kind: 'char', desc: 'monstrous dark spider, glossy purple-black chitin armor shell, eight long jointed legs, four glowing violet eyes, dripping venom fangs' },
  { id: 'warlock', kind: 'char', desc: 'sinister dark warlock, hooded tattered deep-purple robes, gnarled black wooden staff topped with a sickly green glowing skull orb' },
  { id: 'flyer', kind: 'char', desc: 'flying shadow beast, leathery bat-like wings spread, wispy dark blue ghostly body, glowing red eyes, small claws, hovering pose' },
  { id: 'warMachine', kind: 'char', desc: 'fantasy siege war machine walker, riveted dark iron plates on four mechanical legs, one heavy cannon for an arm, small furnace with orange glow on its back' },
  { id: 'aetherTank', kind: 'char', desc: 'magical heavy tank beast, massive armored quadruped creature with sloped aether-steel shell, cyan glowing crystal cannon mounted on its back, heavy treads-like feet' },
  { id: 'smallDragon', kind: 'char', desc: 'small cheeky dragon, teal-green scales with pale belly, small wings, tiny curved horns, playful crouching pose, cartoon stylized' },
  { id: 'crystalMonster', kind: 'char', desc: 'crystal monster, humanoid beast overgrown with jagged glowing blue and violet crystal shards, crystal spikes on shoulders and back, dim inner light' },
  { id: 'hunter', kind: 'char', desc: 'lean werewolf-like hunter beast, dark fur, leather straps with small pouches, twin curved daggers, glowing amber eyes, crouched agile stance' },
  { id: 'destroyer', kind: 'char', desc: 'hulking destroyer demon, black iron armor with glowing magma cracks, horned helm, enormous cleaver blade dragged in one hand' },
  { id: 'summoner', kind: 'char', desc: 'eerie summoner, robed figure in faded green-grey vestments, three small ghostly spirit wisps floating around, ornate brass rings circling one hand' },
  { id: 'spirit', kind: 'char', desc: 'pale translucent ghost spirit, flowing tattered pale-blue robe fading into wispy tail instead of legs, softly glowing white eyes, gentle hover' },
  { id: 'shadowSoldier', kind: 'char', desc: 'disciplined shadow soldier, dark navy segmented armor with violet energy trim lines, tall spear with dark banner, full helm with T visor' },
  { id: 'annihilator', kind: 'char', desc: 'giant annihilator siege construct, towering dark metal golem with multiple shoulder cannons, glowing red reactor core in chest, huge armored fists' },

  // ---------------- bosses (5) ----------------
  { id: 'golemKing', kind: 'char', desc: 'colossal ancient stone golem king, carved granite body with golden royal crown engravings, glowing amber runes on shoulders, massive stone fists, regal bearing' },
  { id: 'fireGiant', kind: 'char', desc: 'towering fire giant, molten magma skin with glowing lava cracks, obsidian black armor plates, flaming beard and hair, huge obsidian club' },
  { id: 'iceGiant', kind: 'char', desc: 'towering ice giant, frost-blue glacier body with frozen armor spikes, icicle beard, glowing pale-cyan eyes, frozen tundra aura' },
  { id: 'blackDragon', kind: 'char', desc: 'massive black dragon standing on four legs with spread wings, glossy dark scales with purple sheen, curved obsidian horns, violet fire glowing in throat' },
  { id: 'darkLord', kind: 'char', desc: 'final dark lord boss, tall regal demon warlord, ornate obsidian armor with crimson trim, huge curved horns on helm, black greatsword, flowing shadow cape' },

  // ---------------- towers (10) ----------------
  { id: 'sentinel', kind: 'tower', desc: 'classic guard watchtower, round warm-stone tower with wooden roof cone, crenellated battlements, small pennant flag' },
  { id: 'lightning', kind: 'tower', desc: 'tall lightning spire, copper-plated tower with Tesla coil rings at top, small glowing blue energy orbs floating around the tip' },
  { id: 'fire', kind: 'tower', desc: 'short fire bastion, heavy stone round tower topped with a large bronze brazier cauldron of bright flames' },
  { id: 'ice', kind: 'tower', desc: 'tall crystalline ice tower, translucent frozen-blue crystal spire with jagged ice shards growing from its sides, frost and snow accents' },
  { id: 'cannon', kind: 'tower', desc: 'squat cannon fortress, wide stone base with iron-reinforced walls and a big black cannon barrel on a rotating top mount' },
  { id: 'poison', kind: 'tower', desc: 'twisted venom alchemist spire, sickly green tower of stacked glass vessels and copper pipes, dripping toxic bubbles' },
  { id: 'ballista', kind: 'tower', desc: 'wooden ballista fort platform, sturdy timber tower with a huge mounted crossbow on top, rope and winch details' },
  { id: 'arcane', kind: 'tower', desc: 'arcane prism tower, floating glowing purple crystal obelisk hovering between carved stone arch pedestals, rune rings' },
  { id: 'temple', kind: 'tower', desc: 'ancient Persian fire temple tower, sandstone tiered architecture with columns and an eternal flame altar burning on top' },
  { id: 'void', kind: 'tower', desc: 'dark void spire, obsidian black twisted tower with a glowing purple void portal ring floating at its top, tiny stars in the void' },
];

export function conceptPrompt(r) {
  const style = r.kind === 'char' ? CHAR_STYLE : TOWER_STYLE;
  return `${r.desc}, ${style}`;
}
