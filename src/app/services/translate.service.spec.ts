import { TestBed } from '@angular/core/testing';
import { TRANSLATIONS, TranslateService } from './translate.service';
import type { Language, TranslationKey } from './translate.service';

/** A key that exists in no dictionary, used to pin the documented fallback behaviour. */
const UNKNOWN_KEY = 'not_a_real_key' as unknown as TranslationKey;

describe('TranslateService', () => {
  let service: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslateService);
  });

  it('should start in Chinese', () => {
    expect(service.current).toBe('zh');
    expect(service.language()).toBe('zh');
    expect(service.translate('app_title')).toBe('您吉响');
    expect(service.translate('metronome')).toBe('节拍器');
  });

  it('should translate into English after setLanguage("en")', () => {
    service.setLanguage('en');

    expect(service.current).toBe('en');
    expect(service.translate('app_title')).toBe('NinGaSound');
    expect(service.translate('metronome')).toBe('Metronome');
    expect(service.translate('start')).toBe('Start');
  });

  it('should translate back into Chinese after setLanguage("zh")', () => {
    service.setLanguage('en');
    service.setLanguage('zh');

    expect(service.current).toBe('zh');
    expect(service.translate('metronome')).toBe('节拍器');
  });

  it('should treat any code other than "en" as Chinese', () => {
    service.setLanguage('en');
    expect(service.current).toBe('en');

    for (const code of ['zh', 'fr', 'EN', '', 'de-DE']) {
      service.setLanguage(code);
      expect(service.current).withContext(`code ${JSON.stringify(code)}`).toBe('zh');
      expect(service.translate('metronome')).withContext(`code ${JSON.stringify(code)}`).toBe('节拍器');
    }
  });

  it('should keep both dictionaries on the exact same key set', () => {
    const zhKeys = Object.keys(TRANSLATIONS.zh).sort();
    const enKeys = Object.keys(TRANSLATIONS.en).sort();

    expect(zhKeys.length).toBeGreaterThan(0);
    expect(enKeys).toEqual(zhKeys);
  });

  it('should translate every key of both dictionaries to a non-empty string', () => {
    for (const language of Object.keys(TRANSLATIONS) as Language[]) {
      for (const key of Object.keys(TRANSLATIONS.zh) as TranslationKey[]) {
        const value = TRANSLATIONS[language][key];
        expect(typeof value).withContext(`${language}.${key}`).toBe('string');
        expect(value.length).withContext(`${language}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('should fall back to the key itself for a key that is in no dictionary', () => {
    expect(service.translate(UNKNOWN_KEY)).toBe(UNKNOWN_KEY);

    service.setLanguage('en');
    expect(service.translate(UNKNOWN_KEY)).toBe(UNKNOWN_KEY);
  });

  it('should expose the active language through language$', () => {
    const seen: Language[] = [];
    const subscription = service.language$.subscribe((language) => seen.push(language));

    try {
      // `language$` is backed by an effect, so the value is replayed once effects are flushed.
      TestBed.flushEffects();
      service.setLanguage('en');
      TestBed.flushEffects();
      service.setLanguage('zh');
      TestBed.flushEffects();
    } finally {
      subscription.unsubscribe();
    }

    expect(seen[0]).toBe('zh');
    expect(seen).toContain('en');
    expect(seen[seen.length - 1]).toBe('zh');
  });

  it('should update the language signal and language$ together', () => {
    const seen: Language[] = [];
    const subscription = service.language$.subscribe((language) => seen.push(language));

    try {
      TestBed.flushEffects();
      service.setLanguage('en');

      expect(service.language()).toBe('en');
      expect(service.current).toBe('en');
      TestBed.flushEffects();
      expect(seen[seen.length - 1]).toBe('en');
    } finally {
      subscription.unsubscribe();
    }
  });
});
