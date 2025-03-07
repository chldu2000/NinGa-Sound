import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateService } from './services/translate.service';
import { TranslatePipe } from './pipes/translate.pipe';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, TranslatePipe]
})
export class AppComponent implements OnInit {
  title = 'NingaSound';
  isDarkTheme = false;
  isEnglish = false;

  constructor(private translateService: TranslateService) {}

  ngOnInit() {
    // 从本地存储加载主题和语言设置
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkTheme = savedTheme === 'dark';
      this.applyTheme();
    }
    
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
      this.isEnglish = savedLang === 'en';
      this.translateService.setLanguage(this.isEnglish ? 'en' : 'zh');
    }
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    this.applyTheme();
    localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
  }

  toggleLanguage() {
    this.isEnglish = !this.isEnglish;
    this.translateService.setLanguage(this.isEnglish ? 'en' : 'zh');
    localStorage.setItem('language', this.isEnglish ? 'en' : 'zh');
  }

  private applyTheme() {
    if (this.isDarkTheme) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}
