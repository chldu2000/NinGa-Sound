import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService, TranslationKey } from '../services/translate.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  transform(key: TranslationKey): string {
    return this.translateService.translate(key);
  }
} 