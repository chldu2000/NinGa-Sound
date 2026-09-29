import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService, TranslationKey } from '../services/translate.service';

/**
 * Renders a TranslationKey in the active language.
 *
 * Deliberately impure (`pure: false`): the output depends on TranslateService state, which is not
 * part of the pipe's arguments, so a pure pipe would cache the first language forever. Angular
 * re-evaluates impure pipes on every change-detection pass, and that single reactive path is what
 * makes a language switch propagate to every template: TranslateService stays the only source of
 * truth for the active language and no component keeps its own copy of it.
 */
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
