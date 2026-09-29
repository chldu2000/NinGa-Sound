import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

/**
 * Chinese dictionary: the source of truth for the key set.
 * TranslationKey is derived from `keyof typeof ZH`, and the English dictionary below is typed
 * as `Record<keyof typeof ZH, string>`, so the two languages can never drift apart: a key added
 * here but forgotten in EN (or an extra key in EN) is a compile error, not a runtime surprise.
 */
const ZH = {
  'app_title': '您吉响',
  'metronome': '节拍器',
  'tuner': '调音器(Beta)',
  'start': '开始',
  'stop': '停止',
  'tempo': '速度',
  'standard_tuning': '标准调弦 (E A D G B E)',
  'start_tuning': '开始调音',
  'metronome_intro': '使用这个节拍器来帮助您练习吉他，保持稳定的节奏。',
  'settings': '设置',
  'rhythm_pattern': '节奏型',
  'tuner_intro': '使用这个调音器来确保您的吉他调音准确。',
  // Language toggle affordance: shows the language the user would switch *to*.
  'lang_switch': 'EN',
  'string_6th': '6弦 (E2)',
  'string_5th': '5弦 (A2)',
  'string_4th': '4弦 (D3)',
  'string_3rd': '3弦 (G3)',
  'string_2nd': '2弦 (B3)',
  'string_1st': '1弦 (E4)'
} as const;

/** English dictionary; the annotation is the key-set contract (missing/extra key => build error). */
const EN: Record<keyof typeof ZH, string> = {
  'app_title': 'NinGaSound',
  'metronome': 'Metronome',
  'tuner': 'Tuner (Beta)',
  'start': 'Start',
  'stop': 'Stop',
  'tempo': 'Tempo',
  'standard_tuning': 'Standard Tuning (E A D G B E)',
  'start_tuning': 'Start Tuning',
  'metronome_intro': 'Use this metronome to help you practice guitar and maintain a steady rhythm.',
  'settings': 'Settings',
  'rhythm_pattern': 'Rhythm Pattern',
  'tuner_intro': 'Use this tuner to ensure your guitar is tuned accurately.',
  'lang_switch': '中',
  'string_6th': '6th (E2)',
  'string_5th': '5th (A2)',
  'string_4th': '4th (D3)',
  'string_3rd': '3rd (G3)',
  'string_2nd': '2nd (B3)',
  'string_1st': '1st (E4)'
};

/** Every dictionary, keyed by language code. */
export const TRANSLATIONS = { zh: ZH, en: EN } as const;

/** Language codes that have a dictionary. */
export type Language = keyof typeof TRANSLATIONS;

/** Keys that can be passed to `translate()` / the `translate` pipe. */
export type TranslationKey = keyof typeof TRANSLATIONS['zh'];

@Injectable({
  providedIn: 'root'
})
export class TranslateService {
  /** Single source of truth for the active language. */
  private readonly currentLanguage = signal<Language>('zh');

  /** Reactive language code, for consumers that need the code itself rather than a translation. */
  readonly language = this.currentLanguage.asReadonly();

  /** Observable view of the same state (async-pipe consumers). */
  readonly language$: Observable<Language> = toObservable(this.currentLanguage);

  /** Imperative read of the active language code. */
  get current(): Language {
    return this.currentLanguage();
  }

  /** Set the active language; anything other than 'en' means Chinese. */
  setLanguage(lang: string): void {
    this.currentLanguage.set(lang === 'en' ? 'en' : 'zh');
  }

  /**
   * Translate `key` into the active language.
   * The fallback is decided by `key in dictionary`, not by `value || key`: an intentionally empty
   * translation ('') is a valid translation and must not be mistaken for a missing key.
   */
  translate(key: TranslationKey): string {
    const dictionary: Record<TranslationKey, string> = TRANSLATIONS[this.currentLanguage()];
    return key in dictionary ? dictionary[key] : key;
  }
}
