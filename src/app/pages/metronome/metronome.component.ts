import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'app-metronome',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, FooterComponent],
  template: `
    <div class="page-container">
      <h2>{{ 'metronome' | translate }}</h2>
      <div class="content">
        <p>{{ isEnglish ? 'Use this metronome to help you practice guitar and maintain a steady rhythm.' : '使用这个节拍器来帮助您练习吉他，保持稳定的节奏。' }}</p>
        <div class="card">
          <h3>{{ isEnglish ? 'Settings' : '设置' }}</h3>
          <div class="control-group">
            <div class="tempo-control">
              <div class="bpm-controls">
                <button class="bpm-btn" (click)="adjustBPM(-1)">-</button>
                <div class="bpm-display-container">
                  <label>{{ 'tempo' | translate }}: </label>
                  <span class="bpm-display">{{ bpm }}</span>
                  <span>BPM</span>
                </div>
                <button class="bpm-btn" (click)="adjustBPM(1)">+</button>
              </div>
              <input 
                type="range" 
                min="30" 
                max="300" 
                [value]="bpm" 
                (input)="updateBPM($event)"
                class="slider"
              >
            </div>
            <div class="beat-indicators">
              <div 
                *ngFor="let indicator of beatIndicators; let i = index" 
                class="beat-indicator"
                [class.active]="currentBeat === i"
              ></div>
            </div>
            <div class="control-button-container">
              <button class="btn" (click)="toggleMetronome()">
                {{ (isPlaying ? 'stop' : 'start') | translate }}
              </button>
            </div>
          </div>
          <div class="pattern-select">
            <h4>{{ isEnglish ? 'Rhythm Pattern' : '节奏型' }}</h4>
            <div class="pattern-options">
              <div 
                class="pattern-option" 
                [class.active]="currentPattern === '4/4'"
                (click)="selectPattern('4/4')"
              >4/4</div>
              <div 
                class="pattern-option" 
                [class.active]="currentPattern === '3/4'"
                (click)="selectPattern('3/4')"
              >3/4</div>
              <div 
                class="pattern-option" 
                [class.active]="currentPattern === '6/8'"
                (click)="selectPattern('6/8')"
              >6/8</div>
            </div>
          </div>
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
    .control-group {
      margin: 20px 0;
    }
    
    .tempo-control {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      margin-bottom: 20px;
    }

    .bpm-controls {
      display: flex;
      align-items: center;
      gap: 15px;
      justify-content: center;
    }

    .bpm-display-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .control-button-container {
      display: flex;
      justify-content: center;
      margin-top: 20px;
    }

    .bpm-display {
      width: 60px;
      text-align: center;
      font-size: 16px;
      font-weight: bold;
    }

    .bpm-btn {
      width: 30px;
      height: 30px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s ease;
    }

    .bpm-btn:hover {
      background-color: var(--guitar-sunset-dark);
      color: white;
      border-color: var(--guitar-sunset-dark);
    }
    .slider {
      width: 100%;
      margin: 10px 0;
      -webkit-appearance: none;
      appearance: none;
      height: 8px;
      background: #ddd;
      border-radius: 4px;
      outline: none;
    }
    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      background: var(--guitar-sunset-dark);
      border-radius: 50%;
      cursor: pointer;
    }
    .pattern-options {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    .pattern-option {
      padding: 8px 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .pattern-option:hover {
      background-color: #f0f0f0;
    }
    .pattern-option.active {
      background-color: var(--guitar-sunset-dark);
      color: white;
      border-color: var(--guitar-sunset-dark);
    }
    .beat-indicators {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 15px;
    }
    .beat-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #ddd;
      transition: all 0.2s ease;
    }
    .beat-indicator.active {
      background-color: var(--guitar-sunset-dark);
      transform: scale(1.2);
    }
  `]
})
export class MetronomeComponent implements OnDestroy {
  bpm = 120;
  isPlaying = false;
  private audioContext?: AudioContext;
  private intervalId?: number;
  currentPattern = '4/4';
  currentBeat = -1;
  beatIndicators: number[] = [1, 2, 3, 4];
  get isEnglish() {
    return localStorage.getItem('language') === 'en';
  }

  updateBPM(event: Event) {
    const input = event.target as HTMLInputElement;
    this.bpm = parseInt(input.value);
    if (this.isPlaying) {
      this.stopMetronome();
      this.startMetronome();
    }
  }

  onBpmChange(value: number) {
    if (value < 30) this.bpm = 30;
    else if (value > 300) this.bpm = 300;
    
    if (this.isPlaying) {
      this.stopMetronome();
      this.startMetronome();
    }
  }

  selectPattern(pattern: string) {
    this.currentPattern = pattern;
    this.currentBeat = 0;
    const beatsPerBar = parseInt(pattern.split('/')[0]);
    this.beatIndicators = Array(beatsPerBar).fill(0).map((_, i) => i + 1);
    if (this.isPlaying) {
      this.stopMetronome();
      this.startMetronome();
    }
  }
  toggleMetronome() {
    if (this.isPlaying) {
      this.stopMetronome();
    } else {
      this.startMetronome();
    }
    this.isPlaying = !this.isPlaying;
  }
  private startMetronome() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    
    const interval = (60 / this.bpm) * 1000;
    this.intervalId = window.setInterval(() => {
      this.updateBeat();
      this.playClick();
    }, interval);
  }
  private updateBeat() {
    const beatsPerBar = parseInt(this.currentPattern.split('/')[0]);
    this.currentBeat = (this.currentBeat + 1) % beatsPerBar;
  }

  private stopMetronome() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.currentBeat = -1; // 停止时重置为-1，这样就不会高亮任何指示灯
    }
  }
  private playClick() {
    if (!this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // 第一拍使用更高的频率和音量
    if (this.currentBeat === 0) {
      oscillator.frequency.value = 1500; // 重音使用更高的频率
      gainNode.gain.value = 0.7; // 重音使用更大的音量
    } else {
      oscillator.frequency.value = 1000;
      gainNode.gain.value = 0.5;
    }
    
    oscillator.start();
    
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.05
    );
    
    oscillator.stop(this.audioContext.currentTime + 0.05);
  }
  adjustBPM(change: number) {
    const newBpm = this.bpm + change;
    if (newBpm >= 30 && newBpm <= 300) {
      this.bpm = newBpm;
      if (this.isPlaying) {
        this.stopMetronome();
        this.startMetronome();
      }
    }
  }
  ngOnDestroy() {
    this.stopMetronome();
    this.audioContext?.close();
  }
}