import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'app-tuner',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, FooterComponent],
  template: `
    <div class="page-container">
      <h2>{{ 'tuner' | translate }}</h2>
      <div class="content">
        <p>{{ isEnglish ? 'Use this tuner to ensure your guitar is tuned accurately.' : '使用这个调音器来确保您的吉他调音准确。' }}</p>
        <div class="card">
          <h3>{{ 'standard_tuning' | translate }}</h3>
          <div class="tuner-display">
            <div class="note">{{ currentNote }}</div>
            <div class="tuning-indicator">
              <div class="pitch-labels">
                <span *ngFor="let label of pitchLabels; let i = index"
                      [style.left]="((i / (pitchLabels.length - 1)) * 100) + '%'">
                  {{ label }}
                </span>
              </div>
              <div class="indicator-bar"></div>
              <div class="indicator-pointer" 
                   [class.active]="isListening && !isLowVolume"
                   [style.left]="tuningPosition + '%'"></div>
            </div>
          </div>
          <div class="string-selector">
            <div 
              *ngFor="let string of guitarStrings" 
              class="string" 
              [class.active]="currentString === string.note"
              (click)="selectString(string.note)"
              [attr.data-note]="string.note"
            >
              {{ isEnglish ? string.labelEn : string.labelZh }}
            </div>
          </div>
          <div class="control-button-container">
            <button class="btn" (click)="toggleTuner()">{{ (isListening ? 'stop' : 'start_tuning') | translate }}</button>
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
      width: 100%;
      height: 60px;
      position: relative;
      margin: 20px auto;
      background: #f5f5f5;
      border-radius: 4px;
      box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .indicator-bar {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      background: linear-gradient(
        to right,
        #ff6b6b 0%,
        #ffd93d 25%,
        #4CAF50 50%,
        #ffd93d 75%,
        #ff6b6b 100%
      );
      opacity: 0.2;
    }
    .pitch-labels {
      position: absolute;
      width: 100%;
      height: 20px;
      bottom: 0;
      left: 0;
      display: flex;
      justify-content: space-between;
      padding: 0 10px;
    }
    .pitch-labels span {
      position: absolute;
      transform: translateX(-50%);
      font-size: 12px;
      font-weight: 500;
      color: #444;
      bottom: 2px;
    }
    .indicator-pointer {
      width: 4px;
      height: 40px;
      background: var(--guitar-sunset-dark);
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      border-radius: 2px;
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0.3;
    }
    .indicator-pointer::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      background: var(--guitar-sunset-dark);
      border-radius: 50%;
      top: -6px;
      left: -4px;
      box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
    }
    .indicator-pointer.active {
      opacity: 1;
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
      transition: all 0.3s ease;
    }
    .string:hover {
      background-color: #f0f0f0;
    }
    .string.active {
      background-color: var(--guitar-sunset-dark);
      color: white;
      border-color: var(--guitar-sunset-dark);
    }
    .control-button-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      margin-top: 20px;
    }
  `]
})
export class TunerComponent implements OnInit, OnDestroy {
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private mediaStream?: MediaStream;
  private lastFrequencies: number[] = [];
  private readonly smoothingFactor = 0.85;
  private readonly harmonicThreshold = 0.15;
  private readonly rmsThreshold = 0.015;
  private readonly correlationThreshold = 0.85;
  private readonly frequencyBufferSize = 8;
  private readonly centsSmoothingFactor = 0.7;
  private lastCents = 0;
  isListening = false;
  isLowVolume = true;
  currentNote = '-';
  tuningPosition = 50;
  currentString = '';
  // autoDetectString = false;
  pitchLabels: string[] = [];
  guitarStrings = [
    { note: 'E2', freq: 82.41, labelEn: '6th (E2)', labelZh: '6弦 (E2)' },
    { note: 'A2', freq: 110.00, labelEn: '5th (A2)', labelZh: '5弦 (A2)' },
    { note: 'D3', freq: 146.83, labelEn: '4th (D3)', labelZh: '4弦 (D3)' },
    { note: 'G3', freq: 196.00, labelEn: '3rd (G3)', labelZh: '3弦 (G3)' },
    { note: 'B3', freq: 246.94, labelEn: '2nd (B3)', labelZh: '2弦 (B3)' },
    { note: 'E4', freq: 329.63, labelEn: '1st (E4)', labelZh: '1弦 (E4)' }
  ];
  get isEnglish() {
    return localStorage.getItem('language') === 'en';
  }
  ngOnInit() {
    this.currentString = 'E2';
    this.initializePitchLabels();
    const defaultString = this.guitarStrings.find(s => s.note === 'E2');
    if (defaultString) {
      this.currentNote = defaultString.note;
    }
  }
  ngOnDestroy() {
    this.stopTuner();
  }
  private initializePitchLabels() {
    this.pitchLabels = ['-400¢', '-300¢', '-200¢', '-100¢', '0¢', '+100¢', '+200¢', '+300¢', '+400¢'];
  }
  async toggleTuner() {
    if (this.isListening) {
      this.stopTuner();
    } else {
      await this.startTuner();
    }
  }
  private async startTuner() {
    try {
      this.audioContext = new AudioContext();
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      this.isListening = true;
      this.updatePitch();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }
  private stopTuner() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.isListening = false;
    this.tuningPosition = 50; // 重置指针位置到中间
  }
  selectString(note: string) {
    this.currentString = note;
    this.currentNote = note;
  }
  private updatePitch() {
    if (!this.isListening || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const timeData = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(timeData);

    const frequency = this.detectPitch(timeData, this.audioContext!.sampleRate);
    if (frequency > 0) {
      this.processFrequency(frequency);
    }

    requestAnimationFrame(() => this.updatePitch());
  }
  private detectPitch(buffer: Float32Array, sampleRate: number): number {
    const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
    if (rms < this.rmsThreshold) return -1;

    const correlationBufferLength = Math.floor(buffer.length / 2);
    let correlation = new Float32Array(correlationBufferLength);
    
    for (let i = 0; i < correlationBufferLength; i++) {
      let sum = 0;
      for (let j = 0; j < correlationBufferLength; j++) {
        sum += buffer[j] * buffer[j + i];
      }
      correlation[i] = sum / correlationBufferLength;
    }

    let maxCorrelation = -1;
    let maxIndex = -1;
    for (let i = 1; i < correlation.length; i++) {
      if (correlation[i] > maxCorrelation) {
        maxCorrelation = correlation[i];
        maxIndex = i;
      }
    }

    const normalizedCorrelation = maxCorrelation / correlation[0];
    if (normalizedCorrelation < this.correlationThreshold) return -1;

    return sampleRate / maxIndex;
  }
  private processFrequency(frequency: number) {
    if (frequency < 20 || frequency > 2000) return;

    const targetString = this.guitarStrings.find(s => s.note === this.currentString);
    if (!targetString) return;

    // 获取当前的音量值
    const bufferLength = this.analyser!.frequencyBinCount;
    const timeData = new Float32Array(bufferLength);
    this.analyser!.getFloatTimeDomainData(timeData);
    const rms = Math.sqrt(timeData.reduce((acc, val) => acc + val * val, 0) / bufferLength);
    this.isLowVolume = rms < this.rmsThreshold;

    this.lastFrequencies.push(frequency);
    if (this.lastFrequencies.length > this.frequencyBufferSize) {
      this.lastFrequencies.shift();
    }

    const avgFrequency = this.lastFrequencies.reduce((a, b) => a + b) / this.lastFrequencies.length;
    
    const ratio = avgFrequency / targetString.freq;
    if (ratio < 0.5 || ratio > 2) return;

    const cents = this.calculateCents(avgFrequency, targetString.freq);
    this.lastCents = this.lastCents * this.centsSmoothingFactor + cents * (1 - this.centsSmoothingFactor);
    // 将±400音分映射到0-100的位置范围
    this.tuningPosition = Math.max(0, Math.min(100, 50 + (this.lastCents / 400) * 50));
  }
  private findClosestString(frequency: number) {
    if (!this.currentString) return null;
    const targetString = this.guitarStrings.find(s => s.note === this.currentString);
    if (!targetString) return null;

    const ratio = frequency / targetString.freq;
    if (ratio < 0.5 || ratio > 2) return null;

    return targetString;
  }
  private calculateCents(frequency: number, targetFrequency: number): number {
    return 1200 * Math.log2(frequency / targetFrequency);
  }
}