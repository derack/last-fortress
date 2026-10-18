// راستی‌آزمایی داده‌های ۱۰۰ مرحله‌ای — بدون نیاز به باندلر: شبیه‌سازی دستی
import { readFileSync } from 'fs';
// از tsx استفاده نمی‌کنیم؛ به‌جایش باندل را از dev سرور می‌گیریم — ساده‌تر: بررسی ساختاری فایل
const src = readFileSync('src/game/data/levels.ts', 'utf8');
const enemiesSrc = readFileSync('src/game/data/enemies.ts', 'utf8');
const enemyIds = [...enemiesSrc.matchAll(/^  ([a-zA-Z]+): \{$/gm)].map(m => m[1]);
console.log('enemy ids:', enemyIds.length);
// همهٔ enemy های استفاده‌شده در pools و bosses باید وجود داشته باشند
const refs = [...src.matchAll(/\b(shadowSoldier|warrior|spider|hunter|flyer|shadow|crystalMonster|summoner|spirit|warlock|smallDragon|destroyer|golem|warMachine|aetherTank|golemKing|fireGiant|iceGiant|blackDragon|annihilator|darkLord)\b/g)].map(m=>m[1]);
const missing = [...new Set(refs)].filter(id => !enemyIds.includes(id));
console.log('missing enemy refs:', missing.length ? missing : 'NONE ✓');
