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
        <p>{{ 'metronome_intro' | translate }}</p>
        <div class="card">
          <h3>{{ 'settings' | translate }}</h3>
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
            <h4>{{ 'rhythm_pattern' | translate }}</h4>
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
    /* T9: min-height: 100vh 已删除。本组件规则的特异度 (0,2,0) 高于全局
       .page-container (0,1,0)，把容器撑成整屏高；而 .main-content 的内容盒因
       20px 上下内边距少 40px（移动端侧边栏占位后少 144px），于是页面恒定多出一段
       滚不到内容的空滚动。铺满滚动容器由全局的 height: 100% 负责。 */
    .page-container {
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
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--control-bg);
      color: var(--text-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s ease;
    }

    .bpm-btn:hover {
      background-color: var(--guitar-sunset-dark);
      color: var(--text-on-sunset);
      border-color: var(--guitar-sunset-dark);
    }
    .slider {
      width: 100%;
      margin: 10px 0;
      -webkit-appearance: none;
      appearance: none;
      height: 8px;
      background: var(--input-bg);
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
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--card-background);
      color: var(--text-color);
      cursor: pointer;
      transition: all 0.3s ease;
    }
    /* 无需 :hover:not(.active)：.pattern-option.active (0,3,0) 天然高于 :hover (0,2,0) */
    .pattern-option:hover {
      background-color: var(--surface-hover);
      color: var(--text-color);
    }
    .pattern-option.active {
      background-color: var(--guitar-sunset-dark);
      color: var(--text-on-sunset);
      border-color: var(--guitar-sunset-dark);
    }
    .beat-indicators {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 15px;
    }
    /* T9 决策：保留 #ddd 字面量，不引入 --beat-indicator-off-bg。
       实测（Chrome 154 headless，getComputedStyle + WCAG 对比度换算，两主题同为该色）：
         #ddd vs 激活橙 #e25822 = 2.74:1（唯一可用的激活/未激活区分度）
         #ddd vs 亮色卡片 #ffffff = 1.36:1；vs 暗色卡片 #2d2d2d = 10.14:1
       让它随主题变化并不会更好：暗色卡片下未激活点自身要达到 3:1 需相对亮度
       L >= 0.179，而 L 落在 0.179~0.233 时与激活橙只剩 1.00~1.23:1，等于失去区分度；
       L <= 0.053 虽能保住 2.74:1，但自身对卡片只有 1.35:1（几乎不可见）。
       亮色下要让未激活点对白卡达到 3:1 需 #8a8a8a 一类中灰，与激活橙只剩 1.08:1。
       即该色值的最优点（L >= 0.724，约等于 #ddd）与主题无关，故保留原值并记录。 */
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
  // ---- timing / BPM constants ----
  // Lookahead scheduler: poll every 25ms, hand the next 100ms of beats to the audio clock.
  private static readonly MIN_BPM = 30;
  private static readonly MAX_BPM = 300;
  private static readonly DEFAULT_BPM = 120;
  private static readonly LOOKAHEAD_MS = 25;
  private static readonly SCHEDULE_AHEAD_S = 0.1;
  private static readonly CLICK_DURATION_S = 0.05;

  bpm = 120;
  isPlaying = false;
  currentPattern = '4/4';
  currentBeat = -1;
  beatIndicators: number[] = [1, 2, 3, 4];

  private audioContext?: AudioContext;
  private schedulerId?: number;
  private nextNoteTime = 0;
  private nextBeatIndex = 0;
  private visualTimers: number[] = [];

  // Beats per bar for the current pattern; always a positive integer.
  private get beatsPerBar(): number {
    const beats = Number.parseInt(this.currentPattern.split('/')[0], 10);
    return Number.isFinite(beats) && beats > 0 ? beats : 4;
  }

  updateBPM(event: Event) {
    const input = event.target as HTMLInputElement;
    // Single entry point: NaN (e.g. empty value) keeps the previous BPM.
    this.applyBpm(Number.parseInt(input.value, 10));
    // Mirror the clamp back into the control so the slider can never show an out-of-range value.
    if (input.value !== String(this.bpm)) {
      input.value = String(this.bpm);
    }
  }

  // Single entry point for every BPM write: clamp to [30, 300] and reject non-finite values.
  private applyBpm(value: number): void {
    const fallback = Number.isFinite(this.bpm) ? this.bpm : MetronomeComponent.DEFAULT_BPM;
    this.bpm = Number.isFinite(value)
      ? Math.min(MetronomeComponent.MAX_BPM, Math.max(MetronomeComponent.MIN_BPM, value))
      : fallback;
  }

  selectPattern(pattern: string) {
    this.currentPattern = pattern;
    this.currentBeat = 0;
    this.beatIndicators = Array.from({ length: this.beatsPerBar }, (_, i) => i + 1);
    if (this.isPlaying) {
      // Changing the time signature resets the bar phase on purpose.
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
    const ctx = this.audioContext ?? (this.audioContext = new AudioContext());
    void ctx.resume().catch(() => undefined);

    if (this.schedulerId !== undefined) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = undefined;
    }
    this.cancelScheduledVisuals();

    // Restart the bar at beat 0; the first beat is due at "now", so it sounds immediately.
    this.nextBeatIndex = 0;
    this.currentBeat = -1;
    this.nextNoteTime = ctx.currentTime;
    this.schedulerId = window.setInterval(
      () => this.scheduler(),
      MetronomeComponent.LOOKAHEAD_MS
    );
    this.scheduler();
  }

  // Lookahead scheduler. Every beat inside the next SCHEDULE_AHEAD_S seconds is queued on the
  // audio clock; timer jitter only affects *when a beat is queued*, never *when it sounds*.
  private scheduler(): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    if (this.nextNoteTime < ctx.currentTime) {
      // The poll was delayed (e.g. a throttled tab). Re-align to the audio clock instead of
      // firing a burst of late beats; times still come from the audio clock, so no drift builds up.
      this.nextNoteTime = ctx.currentTime;
    }

    const secondsPerBeat = 60 / this.bpm;
    while (this.nextNoteTime < ctx.currentTime + MetronomeComponent.SCHEDULE_AHEAD_S) {
      const beatIndex = this.nextBeatIndex;
      this.playClick(beatIndex, this.nextNoteTime);
      this.scheduleBeatIndicator(beatIndex, this.nextNoteTime);
      this.nextNoteTime += secondsPerBeat;
      this.nextBeatIndex = (this.nextBeatIndex + 1) % this.beatsPerBar;
    }
  }

  // Light the matching indicator roughly when the beat is audible.
  private scheduleBeatIndicator(beatIndex: number, time: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    const timerId = window.setTimeout(() => {
      this.visualTimers = this.visualTimers.filter((id) => id !== timerId);
      this.currentBeat = beatIndex;
    }, delayMs);
    this.visualTimers.push(timerId);
  }

  private cancelScheduledVisuals(): void {
    for (const timerId of this.visualTimers) {
      window.clearTimeout(timerId);
    }
    this.visualTimers = [];
  }

  private stopMetronome() {
    if (this.schedulerId !== undefined) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = undefined;
    }
    this.cancelScheduledVisuals();
    this.currentBeat = -1; // Stop: no indicator highlighted.
    this.nextBeatIndex = 0;
  }

  // Queue one click at an absolute audio-clock time; nodes release themselves on 'ended'.
  private playClick(beatIndex: number, time: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Beat 1 is the accent: higher pitch and louder.
    const isAccent = beatIndex === 0;
    oscillator.frequency.value = isAccent ? 1500 : 1000;
    const peakGain = isAccent ? 0.7 : 0.5;

    gainNode.gain.setValueAtTime(peakGain, time);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      time + MetronomeComponent.CLICK_DURATION_S
    );
    oscillator.start(time);
    oscillator.stop(time + MetronomeComponent.CLICK_DURATION_S);

    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  }
  adjustBPM(change: number) {
    // Same single entry point as the slider; no restart, so the bar phase is preserved.
    this.applyBpm(this.bpm + change);
  }

  ngOnDestroy() {
    this.stopMetronome();
    const ctx = this.audioContext;
    this.audioContext = undefined;
    if (ctx) {
      // close() is async and may reject (e.g. already closed); ignore the rejection on purpose.
      void ctx.close().catch(() => undefined);
    }
  }
}