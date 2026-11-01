import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const output = await build({ stdin: { contents: `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import translations from './dashboard/src/translations';
import { setLanguage, t, translate, subscribeLanguage, getLanguage } from './dashboard/src/i18n';
import Landing from './dashboard/src/Landing';
import MealEntry from './dashboard/src/MealEntry';
import MealHistory from './dashboard/src/MealHistory';
import MealResult from './dashboard/src/MealResult';
import Onboarding from './dashboard/src/Onboarding';
import Login from './dashboard/src/Login';
import SubscriptionPanel from './dashboard/src/SubscriptionPanel';
const languages = ['es','fr','de'];
const keys = Object.keys(translations.es).sort();
for (const language of languages) {
 assert.deepEqual(Object.keys(translations[language]).sort(), keys);
 for (const key of keys) {
  assert(translations[language][key].trim(), language + ': empty translation for '+key);
  assert.deepEqual((translations[language][key].match(/\\{\\w+\\}/g)||[]).sort(), (key.match(/\\{\\w+\\}/g)||[]).sort(), language + ': interpolation mismatch for '+key);
 }
 setLanguage(language);
 const landing=renderToStaticMarkup(React.createElement(Landing));
 assert(landing.includes(t('Free AI calorie counter')));
 assert(!landing.includes('Know your meal.'));
 const entry=renderToStaticMarkup(React.createElement(MealEntry,{editing:null,date:'2026-10-31',save(){},close(){}}));
 assert(entry.includes(t('Analyze Meal'))); assert(entry.includes(t('Photos'))); assert(entry.includes(t('Camera')));
 const history=renderToStaticMarkup(React.createElement(MealHistory,{meals:[],favorites:[],date:'2026-10-31',today:'2026-10-31',selectDate(){},edit(){},remove(){},toggleFavorite(){},logFavorite(){},add(){}}));
 assert(history.includes(t('No meals logged'))); assert(history.includes(t('Weekly')));
 const result=renderToStaticMarkup(React.createElement(MealResult,{initial:{nutrition:{calories:140,protein:12.6,carbs:1.2,fat:9.8},summary:'User supplied food'},description:'User supplied food',date:'2026-10-31',save(){},back(){}}));
 assert(result.includes(t('Nutrition snapshot'))); assert(result.includes('User supplied food')); assert(result.includes(t('Protein')));
 if (language === 'de' || language === 'fr') assert(result.includes('12,6'));
 const setup=renderToStaticMarkup(React.createElement(Onboarding,{complete(){},skip(){}}));
 const login=renderToStaticMarkup(React.createElement(Login,{guest(){}})); assert(login.includes(t('Welcome to FitMacro'))); assert(login.includes(t('Continue with Google')));
 const plans=renderToStaticMarkup(React.createElement(SubscriptionPanel,{signedIn:false,login(){}})); assert(plans.includes(t('Sign in to subscribe'))); assert(plans.includes(t('3 AI analyses / day')));
 assert(setup.includes(t('Age (years)'))); assert(setup.includes(t('Continue')));
 assert.equal(translate('Unknown user meal',language),'Unknown user meal');
 assert(!translate('{remaining} of {limit} free analyses remaining today.',language,{remaining:2,limit:3}).includes('{'));
}
let updates=0; const unsubscribe=subscribeLanguage(()=>updates++); setLanguage('en'); assert.equal(updates,1); unsubscribe(); setLanguage('es'); assert.equal(updates,1); assert.equal(getLanguage(),'es'); setLanguage('en');
console.log('Language checks passed: three complete catalogs, placeholder parity, all core screen renders, locale decimals, user food preservation, and language-switch subscriptions.');
`, resolveDir:process.cwd(),loader:'tsx' },bundle:true,platform:'node',format:'cjs',write:false });
const module={exports:{}};
new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
// Exercise preference initialization in isolated bundles with browser-like storage.
const localeBundle = await build({ entryPoints:['dashboard/src/i18n.ts'],bundle:true,platform:'node',format:'cjs',write:false });
function browserLocale({query='',path='/dashboard',saved=null,browser='en-US',blocked=false}={}) {
 const values=new Map(saved ? [['fitmacro.web.language',saved]] : []);
 const location={href:'https://fitmacro.ca'+path+query,search:query,pathname:path};
 const fakeWindow={location,history:{replaceState(_state,_title,url){location.href=String(url);location.search=new URL(url).search;location.pathname=new URL(url).pathname;}}};
 const storage={getItem(key){if(blocked)throw new Error('blocked');return values.get(key)??null;},setItem(key,value){if(blocked)throw new Error('blocked');values.set(key,value);}};
 const doc={documentElement:{lang:'en'}};
 const loaded={exports:{}};
 new Function('require','module','exports','window','localStorage','navigator','document',localeBundle.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports,fakeWindow,storage,{language:browser},doc);
 return {i18n:loaded.exports,values,doc,location};
}
const stored=browserLocale({saved:'fr',browser:'de-DE'}); assert.equal(stored.i18n.getLanguage(),'fr');stored.i18n.setLanguage('es');assert.equal(stored.values.get('fitmacro.web.language'),'es');assert.equal(stored.doc.documentElement.lang,'es');
const query=browserLocale({query:'?lang=de',saved:'fr'});assert.equal(query.i18n.getLanguage(),'de');query.i18n.setLanguage('fr');assert.equal(query.location.search,'?lang=fr');
assert.equal(browserLocale({saved:'invalid',browser:'es-MX'}).i18n.getLanguage(),'es');
assert.equal(browserLocale({browser:'it-IT'}).i18n.getLanguage(),'en');
const blocked=browserLocale({blocked:true,browser:'de-DE'});blocked.i18n.setLanguage('fr');assert.equal(blocked.i18n.getLanguage(),'fr');
console.log('Language preference checks passed: browser fallback, persisted choice, query overrides, reload URL updates, and blocked storage.');

const spanishPage=browserLocale({path:'/es/contador-calorias-ia-gratis',saved:'de',browser:'fr-FR'}); assert.equal(spanishPage.i18n.getLanguage(),'es');spanishPage.i18n.setLanguage('fr');assert.equal(spanishPage.location.pathname,'/fr/compteur-calories-ia-gratuit');
const englishPage=browserLocale({path:'/free-ai-calorie-counter',saved:'de',browser:'de-DE'});assert.equal(englishPage.i18n.getLanguage(),'en');
console.log('SEO locale checks passed: explicit page language wins over saved/browser preferences and switching updates the public URL.');
