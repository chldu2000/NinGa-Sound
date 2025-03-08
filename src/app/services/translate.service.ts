import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type TranslationKey = keyof (typeof TranslateService.prototype.translations)['zh'];

@Injectable({
  providedIn: 'root'
})
export class TranslateService {
  public translations = {
    'zh': {
      'app_title': '您吉响',
      'metronome': '节拍器',
      'tuner': '调音器(Beta)',
      'start': '开始',
      'stop': '停止',
      'tempo': '速度',
      'standard_tuning': '标准调弦 (E A D G B E)',
      'start_tuning': '开始调音'
    },
    'en': {
      'app_title': 'NinGaSound',
      'metronome': 'Metronome',
      'tuner': 'Tuner (Beta)',
      'start': 'Start',
      'stop': 'Stop',
      'tempo': 'Tempo',
      'standard_tuning': 'Standard Tuning (E A D G B E)',
      'start_tuning': 'Start Tuning'
    }
  } as const;
  
  private currentLang: 'zh' | 'en' = 'zh';
  private languageSubject = new BehaviorSubject<string>(this.currentLang);
  
  language$ = this.languageSubject.asObservable();
  
  setLanguage(lang: string) {
    this.currentLang = lang as 'zh' | 'en';
    this.languageSubject.next(lang);
  }
  
  translate(key: TranslationKey): string {
    return this.translations[this.currentLang][key] || key;
  }
} 