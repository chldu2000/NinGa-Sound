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
  // Tuner status line: exactly one of these is shown at a time, so the user always knows
  // whether the tuner is idle, too quiet, detecting, on another string, or already in tune.
  'tuner_idle': '点击下方按钮开始调音',
  'tuner_too_quiet': '音量太低，请拨弦',
  'tuner_detecting': '正在检测…',
  'tuner_in_tune': '已调准',
  'tuner_flat': '偏低',
  'tuner_sharp': '偏高',
  // Rendered after the detected note name, e.g. "A2 不是当前选中的弦".
  'tuner_wrong_string': '不是当前选中的弦',
  // Microphone failures used to be silent (console only); these make the cause visible.
  'mic_denied': '麦克风权限被拒绝，请在浏览器设置中允许后重试',
  'mic_no_device': '未找到可用的麦克风设备',
  'mic_busy': '麦克风被其他程序占用，请关闭后重试',
  'mic_insecure': '当前环境无法采集麦克风，请使用 HTTPS 访问',
  'mic_unknown': '无法访问麦克风，请重试',
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
  'tuner_idle': 'Press the button below to start tuning',
  'tuner_too_quiet': 'Too quiet - pluck a string',
  'tuner_detecting': 'Detecting...',
  'tuner_in_tune': 'In tune',
  'tuner_flat': 'Flat',
  'tuner_sharp': 'Sharp',
  'tuner_wrong_string': 'is not the selected string',
  'mic_denied': 'Microphone permission denied - allow it in your browser and retry',
  'mic_no_device': 'No microphone device found',
  'mic_busy': 'Microphone is in use by another app - close it and retry',
  'mic_insecure': 'Microphone capture is unavailable - use HTTPS',
  'mic_unknown': 'Could not access the microphone - please retry',
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
