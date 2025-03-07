import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'app-tuner',
  standalone: true,
  imports: [CommonModule, TranslatePipe, FooterComponent],
  template: `
    <div class="page-container">
      <h2>{{ 'tuner' | translate }}</h2>
      <div class="content">
        <p>{{ isEnglish ? 'Use this tuner to ensure your guitar is tuned accurately.' : '使用这个调音器来确保您的吉他调音准确。' }}</p>
        <div class="card">
          <h3>{{ 'standard_tuning' | translate }}</h3>
          <div class="tuner-display">
            <div class="note">E</div>
            <div class="tuning-indicator">
              <div class="indicator-bar"></div>
              <div class="indicator-pointer"></div>
            </div>
          </div>
          <div class="string-selector">
            <div class="string" data-note="E">{{ isEnglish ? '6th (E)' : '6弦 (E)' }}</div>
            <div class="string" data-note="A">{{ isEnglish ? '5th (A)' : '5弦 (A)' }}</div>
            <div class="string" data-note="D">{{ isEnglish ? '4th (D)' : '4弦 (D)' }}</div>
            <div class="string" data-note="G">{{ isEnglish ? '3rd (G)' : '3弦 (G)' }}</div>
            <div class="string" data-note="B">{{ isEnglish ? '2nd (B)' : '2弦 (B)' }}</div>
            <div class="string" data-note="E">{{ isEnglish ? '1st (E)' : '1弦 (E)' }}</div>
          </div>
          <button class="btn">{{ 'start_tuning' | translate }}</button>
        </div>
      </div>
      <app-footer></app-footer>
    </div>
  `,
  styles: [`
    .page-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .tuner-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 20px 0;
    }
    
    .note {
      font-size: 48px;
      font-weight: bold;
      color: var(--guitar-sunset-dark);
    }
    
    .tuning-indicator {
      width: 200px;
      height: 40px;
      position: relative;
      margin: 20px 0;
    }
    
    .indicator-bar {
      width: 100%;
      height: 8px;
      background: #ddd;
      border-radius: 4px;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    }
    
    .indicator-pointer {
      width: 12px;
      height: 30px;
      background: var(--guitar-sunset-dark);
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: 3px;
    }
    
    .string-selector {
      display: flex;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 10px;
      margin: 20px 0;
    }
    
    .string {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      text-align: center;
    }
    
    .string:hover {
      background-color: #f0f0f0;
    }
  `]
})
export class TunerComponent {
  // 从服务获取语言状态
  get isEnglish() {
    return localStorage.getItem('language') === 'en';
  }
}