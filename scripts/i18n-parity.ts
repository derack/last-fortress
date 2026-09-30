import { dictionaries } from '../src/game/data/i18n';
const fa = Object.keys(dictionaries.fa), en = Object.keys(dictionaries.en);
const mInEn = fa.filter(k => !(k in dictionaries.en)), mInFa = en.filter(k => !(k in dictionaries.fa));
console.log('fa:', fa.length, '| en:', en.length);
console.log('missing in en:', mInEn.length ? mInEn : 'none');
console.log('missing in fa:', mInFa.length ? mInFa : 'none');
