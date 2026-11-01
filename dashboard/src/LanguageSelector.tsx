import { useSyncExternalStore } from 'react';
import { getLanguage, isLanguage, languages, setLanguage, subscribeLanguage, t } from './i18n';
export default function LanguageSelector() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return <label className="language-selector"><span className="sr-only">{t('Language')}</span><select aria-label={t('Language')} value={language} onChange={event => { if (isLanguage(event.target.value)) setLanguage(event.target.value); }}>{Object.entries(languages).map(([value,label]) => <option key={value} value={value} lang={value}>{label}</option>)}</select></label>;
}
