import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import type { TranslationKey } from '../../services/translate.service';
import { FooterComponent } from '../../components/footer/footer.component';

/**
 * 麦克风采集失败的原因。把浏览器抛出的 DOMException 归一到这几个可翻译的状态，
 * 这样用户看到的是“权限被拒绝 / 设备被占用”，而不是一片沉默。
 */
type MicError = '' | 'denied' | 'no-device' | 'busy' | 'insecure' | 'unknown';

@Component({
  selector: 'app-tuner',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, FooterComponent],
  template: `
    <div class="page-container">
      <h2>{{ 'tuner' | translate }}</h2>
      <div class="content">
        <p>{{ 'tuner_intro' | translate }}</p>
        <div class="card">
          <h3>{{ 'standard_tuning' | translate }}</h3>
          <div class="tuner-display">
            <div class="note" [class.in-tune]="isInTune">{{ displayNote }}</div>
            <div class="tuning-indicator">
              <div class="pitch-labels">
                <span *ngFor="let label of pitchLabels; let i = index"
                      [style.left]="((i / (pitchLabels.length - 1)) * 100) + '%'">
                  {{ label }}
                </span>
              </div>
              <div class="indicator-bar"></div>
              <div class="indicator-pointer" 
                   [class.active]="isPointerActive"
                   [style.left]="tuningPosition + '%'"></div>
            </div>
          </div>
          <!-- 状态行：调音器以前在“没拾到音 / 弹错弦 / 麦克风失败”时完全沉默，
               用户只能看到指针不动。这里始终给出唯一一条明确的状态。 -->
          <div class="tuner-status"
               role="status"
               data-testid="tuner-status"
               [class.status-error]="micError !== ''"
               [class.status-in-tune]="isInTune"
          >
            <span class="detected-note" *ngIf="isOtherStringDetected">{{ detectedNote }}&nbsp;</span>{{ statusKey | translate }}
          </div>
          <div class="string-selector">
            <div 
              *ngFor="let string of guitarStrings" 
              class="string" 
              [class.active]="currentString === string.note"
              [class.detected]="detectedString === string.note"
              (click)="selectString(string.note)"
              [attr.data-note]="string.note"
            >
              {{ string.labelKey | translate }}
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
    /* T9: min-height: 100vh 已删除。本组件规则的特异度 (0,2,0) 高于全局
       .page-container (0,1,0)，把容器撑成整屏高；而 .main-content 的内容盒因
       20px 上下内边距少 40px（移动端侧边栏占位后少 144px），于是页面恒定多出一段
       滚不到内容的空滚动。铺满滚动容器由全局的 height: 100% 负责。 */
    .page-container {
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
    .note.in-tune {
      color: var(--status-in-tune);
    }
    /* 固定最小高度，避免状态文案在“--”与长句之间切换时引起布局跳动 */
    .tuner-status {
      min-height: 1.4em;
      margin: 0 0 4px;
      text-align: center;
      font-size: 0.95em;
      color: var(--text-muted-strong);
    }
    .tuner-status.status-in-tune {
      color: var(--status-in-tune);
      font-weight: 600;
    }
    .tuner-status.status-error {
      color: var(--status-error);
    }
    .tuning-indicator {
      width: 100%;
      height: 60px;
      position: relative;
      margin: 20px auto;
      background: var(--surface-muted);
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
      color: var(--text-muted-strong);
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
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--card-background);
      color: var(--text-color);
      cursor: pointer;
      text-align: center;
      transition: all 0.3s ease;
    }
    /* 无需 :hover:not(.active)：.string.active (0,3,0) 天然高于 :hover (0,2,0) */
    .string:hover {
      background-color: var(--surface-hover);
      color: var(--text-color);
    }
    /* 正在弹的弦（不改变目标弦，只做标记）；必须写在 .active 之前，
       两者特异度相同 (0,2,0)，靠后者胜出，这样选中的弦仍然显示为激活态。 */
    .string.detected {
      border-style: dashed;
      border-color: var(--guitar-sunset-light);
    }
    .string.active {
      background-color: var(--guitar-sunset-dark);
      color: var(--text-on-sunset);
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
  /** 音名表：把检测到的频率换算成显示用音名（纯符号，不需要翻译）。 */
  private static readonly noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  /**
   * 自相关前先做 D 倍抽取：物理分析窗长度不变，而 lag 数与每个 lag 的乘加次数各降 D 倍，
   * 合计把自相关的常数因子降低约 D²。抽取用两趟长度 D 的滑动平均（boxcar²）抗折叠。
   */
  private readonly decimationFactor = 8;
  /** 可检出的最高基频(Hz)：覆盖 E4(329.63) 与 12 品变调夹八度(659.26)，也覆盖 440Hz 校验音。 */
  private readonly maxDetectFrequency = 700;
  /** lag 搜索下界对应 30Hz：低于任何吉他调弦（drop-C 为 65.41Hz），为 m 次周期精化留出整周期数。 */
  private readonly minSearchFrequency = 30;
  /** “显著局部峰”门限（相对全局最大相关值），用于避免纯音上的倍周期八度错误。 */
  private readonly peakThreshold = 0.9;
  /** m 次周期精化要求的最小峰值（相对基频周期处的相关值）。 */
  private readonly periodPeakThreshold = 0.5;
  /** m 次周期精化的最大倍数：避免包络衰减/揉弦时用到相关性过低的远端峰。 */
  private readonly maxRefineMultiple = 4;
  private readonly rmsThreshold = 0.015;
  private readonly correlationThreshold = 0.85;
  private readonly frequencyBufferSize = 8;
  private readonly centsSmoothingFactor = 0.7;
  /** |音分| 落在该范围内即视为已调准。 */
  private readonly inTuneCents = 5;
  /**
   * 判定“在弹另一根弦”的容差：检测音高必须落在某根**其他**标准弦的这个范围内。
   * 只按“最近的弦”判定是不够的——选中的是 E2 却弹高了 300¢ 时，最近的弦会是 A2
   * （差 200¢），但那其实是同一根弦走音，不是弹错弦。加上这个容差后，只有确实
   * 落在别根弦附近才判为弹错弦，真实的音准偏差不会被掩盖。
   */
  private readonly otherStringCents = 50;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private mediaStream?: MediaStream;
  /** 时域样本（长度 = fftSize），全程复用。 */
  private timeData = new Float32Array(0);
  /** 抽取用中间缓冲（长度 = fftSize），全程复用。 */
  private filtered = new Float32Array(0);
  /** 抽取后的分析帧（长度 = fftSize / decimationFactor），全程复用。 */
  private decimated = new Float32Array(0);
  /** 自相关值缓存（长度 = maxLag + 2），全程复用。 */
  private correlation = new Float32Array(0);
  private lastFrequencies: number[] = [];
  private lastCents = 0;
  /** 最近一次平滑后的检测频率(Hz)，0 表示当前帧没有有效检测。 */
  private detectedFrequency = 0;
  isListening = false;
  isLowVolume = true;
  /**
   * 麦克风不可用的原因；'' 表示无错误。原来这里只往 console 写一行，
   * 界面毫无反馈，用户点了按钮像是坏了。
   */
  micError: MicError = '';
  /**
   * 检测音高归属的标准弦音名（'' = 没有可信归属）。仅当检测音高落在某根弦的
   * otherStringCents 范围内时才会被赋值，用来区分三种状态：正在弹目标弦、
   * 正在弹别的弦、偏差大到无法归属。
   */
  detectedString = '';
  /** 目标弦（由 ngOnInit / selectString 更新），指针偏差相对它计算。 */
  currentNote = '-';
  tuningPosition = 50;
  currentString = '';
  pitchLabels: string[] = [];
  guitarStrings: { note: string; freq: number; labelKey: TranslationKey }[] = [
    { note: 'E2', freq: 82.41, labelKey: 'string_6th' },
    { note: 'A2', freq: 110.00, labelKey: 'string_5th' },
    { note: 'D3', freq: 146.83, labelKey: 'string_4th' },
    { note: 'G3', freq: 196.00, labelKey: 'string_3rd' },
    { note: 'B3', freq: 246.94, labelKey: 'string_2nd' },
    { note: 'E4', freq: 329.63, labelKey: 'string_1st' }
  ];
  /** 检测音高对应的音名；没有有效检测时为空串。 */
  get detectedNote(): string {
    return this.detectedFrequency > 0 ? this.frequencyToNoteName(this.detectedFrequency) : '';
  }
  /**
   * 大字显示：正在收音且音量正常时显示“检测到的音名”，否则显示“目标弦”。
   * 显示值永远与当前检测结果一致，不会出现“检测到别的音、却显示 E2”那种矛盾。
   */
  get displayNote(): string {
    if (!this.isListening || this.isLowVolume || this.detectedFrequency <= 0) {
      return this.currentNote;
    }
    return this.detectedNote || this.currentNote;
  }
  /** 正在弹的就是选中的那根弦。 */
  get isTargetStringDetected(): boolean {
    return this.detectedString !== '' && this.detectedString === this.currentString;
  }
  /** 正在弹的是另一根标准弦——是弹错弦，而不是走音。 */
  get isOtherStringDetected(): boolean {
    return this.detectedString !== '' && this.detectedString !== this.currentString;
  }
  /** 已调准：必须在弹目标弦、音量正常、且偏差在 inTuneCents 以内。 */
  get isInTune(): boolean {
    return this.isListening && !this.isLowVolume
      && this.isTargetStringDetected
      && Math.abs(this.lastCents) <= this.inTuneCents;
  }
  /**
   * 指针仅在读数可信时点亮：收音中、音量正常、有检测结果、且弹的是目标弦。
   * 弹错弦时指针置中并变暗，不再像以前那样钉死在端点误导用户。
   */
  get isPointerActive(): boolean {
    return this.isListening && !this.isLowVolume
      && this.detectedFrequency > 0
      && !this.isOtherStringDetected;
  }
  /** 麦克风错误对应的文案键。 */
  get micErrorKey(): TranslationKey {
    switch (this.micError) {
      case 'denied': return 'mic_denied';
      case 'no-device': return 'mic_no_device';
      case 'busy': return 'mic_busy';
      case 'insecure': return 'mic_insecure';
      default: return 'mic_unknown';
    }
  }
  /** 状态行唯一一条文案；任何时刻都必然有值，界面因此不会沉默。 */
  get statusKey(): TranslationKey {
    if (this.micError !== '') return this.micErrorKey;
    if (!this.isListening) return 'tuner_idle';
    if (this.isLowVolume) return 'tuner_too_quiet';
    if (this.detectedFrequency <= 0) return 'tuner_detecting';
    if (this.isOtherStringDetected) return 'tuner_wrong_string';
    if (this.isInTune) return 'tuner_in_tune';
    return this.lastCents < 0 ? 'tuner_flat' : 'tuner_sharp';
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
    this.micError = '';
    // 先确认环境具备采集能力：非安全上下文（HTTP）或过旧的浏览器里 mediaDevices
    // 可能根本不存在。原来这种情形是一个 TypeError 静默消失在 console 里。
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      this.micError = 'insecure';
      this.isListening = false;
      return;
    }
    try {
      this.audioContext = new AudioContext();
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      // 用整个 fftSize(4096 个) 时域样本：低音 E2 的周期在 48kHz 下约 583 个样本，
      // 原来只取 frequencyBinCount(=fftSize/2=1024) 个样本，连一个周期都盖不住，
      // 低音 E 弦在算法上就不可能被检出（这也是 lag 区间要放到 minSearchFrequency 的原因）。
      this.analyser.fftSize = 4096;
      source.connect(this.analyser);
      const frameLength = this.analyser.fftSize;
      const decimatedLength = Math.floor(frameLength / this.decimationFactor);
      // 整个会话只分配一次分析缓冲区，rAF 循环里不再分配任何 Float32Array
      this.timeData = new Float32Array(frameLength);
      this.filtered = new Float32Array(frameLength);
      this.decimated = new Float32Array(decimatedLength);
      this.correlation = new Float32Array(
        Math.floor(this.audioContext.sampleRate / this.decimationFactor / this.minSearchFrequency) + 3
      );
      this.detectedString = '';
      this.isListening = true;
      this.updatePitch();
    } catch (error) {
      // 以前这里只有 console.error：用户点了按钮，界面没有任何反馈。
      this.micError = this.resolveMicError(error);
      console.error('Error accessing microphone:', error);
      // 失败时不要留下半个会话：关掉刚创建的 AudioContext，否则每次重试都泄漏一个。
      if (this.audioContext) {
        void this.audioContext.close().catch(() => undefined);
        this.audioContext = undefined;
      }
      this.analyser = undefined;
      this.mediaStream = undefined;
      this.isListening = false;
    }
  }
  /** 把浏览器的采集异常归一成可显示的原因。 */
  private resolveMicError(error: unknown): MicError {
    const name = (error as { name?: unknown } | null | undefined)?.name;
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return 'denied';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'no-device';
      case 'NotReadableError':
      case 'TrackStartError':
      case 'AbortError':
        return 'busy';
      default:
        return 'unknown';
    }
  }
  private stopTuner() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      // close() 返回 Promise：不接住会在控制台留下 unhandled rejection。
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = undefined;
    }
    this.analyser = undefined;
    this.mediaStream = undefined;
    this.isListening = false;
    this.tuningPosition = 50; // 重置指针位置到中间
    // 清空本次会话的平滑状态，避免下次启动沿用上一次的历史值（陈旧状态）
    this.lastFrequencies = [];
    this.lastCents = 0;
    this.detectedFrequency = 0;
    this.detectedString = '';
    this.isLowVolume = true;
  }
  selectString(note: string) {
    this.currentString = note;
    this.currentNote = note;
    this.detectedFrequency = 0; // 切换目标弦后先显示目标音名，直到下一帧检测结果到达
    // 频率平均窗与弦归属也必须清空：否则切换后的前几帧会把上一根弦的样本一起平均，
    // 归属弦会短暂地显示成旧的弦，指针也会先跳到旧读数再回来。
    this.lastFrequencies = [];
    this.lastCents = 0;
    this.detectedString = '';
    this.tuningPosition = 50;
  }
  private updatePitch() {
    if (!this.isListening || !this.analyser || !this.audioContext) return;

    // 每帧只读一次时域数据，并且复用同一个 Float32Array（原来每帧新建两个数组、读两次数据）
    const buffer = this.timeData;
    this.analyser.getFloatTimeDomainData(buffer);

    // 每帧只算一次 RMS，它是 isLowVolume 的唯一依据；静音时同样会被刷新为 true
    const rms = this.computeRms(buffer);
    this.isLowVolume = rms < this.rmsThreshold;

    // 音量足够才做音高检测；RMS 随频率一起传入 processFrequency，避免重复采样与重复计算
    if (!this.isLowVolume) {
      const frequency = this.detectPitch(buffer, this.audioContext.sampleRate);
      if (frequency > 0) {
        this.processFrequency(frequency, rms);
      }
    }

    requestAnimationFrame(() => this.updatePitch());
  }
  /** 时域数据 RMS：单趟循环、零分配。 */
  private computeRms(buffer: Float32Array): number {
    if (buffer.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }
  /**
   * 两趟长度 D 的滑动平均（等效 boxcar²，对 3~6kHz 的折叠分量有 -8dB 以下衰减）后按 D 抽取。
   * 不做除法：自相关会按能量归一化，绝对幅度无意义。写入的缓冲区全部复用，零堆分配。
   */
  private decimateTo(buffer: Float32Array): Float32Array {
    const factor = this.decimationFactor;
    const length = buffer.length;
    const stage = this.filtered;
    const out = this.decimated;
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += buffer[i];
      if (i >= factor) sum -= buffer[i - factor];
      stage[i] = sum;
    }
    sum = 0;
    let k = 0;
    const outLength = out.length;
    for (let i = 0; i < length; i++) {
      sum += stage[i];
      if (i >= factor) sum -= stage[i - factor];
      if (i % factor === 0 && k < outLength) {
        out[k++] = sum;
      }
    }
    return out;
  }
  /**
   * 自相关基频检测（只读入参、只写组件自有的复用缓冲区；无堆分配、无外部副作用）。
   *
   * 1) 物理分析窗 = 整个 fftSize 帧（48kHz 下 4096 样本 ≈ 85ms ≈ 7 个 E2 周期）。
   *    原实现只读 frequencyBinCount = 1024 个样本、且 lag 只到 511，
   *    即 48kHz 下最低只能到 fs/511 = 93.9Hz，比最低弦 E2(82.41Hz, 周期 583) 还高，
   *    所以低音 E 弦原本在算法上就不可能被检出。
   * 2) 抽取到 fs/D：lag 数与该窗内每个 lag 的乘积项数同时下降，常数因子约降 D²。
   * 3) 每个 lag 固定用 windowLength = N - maxLag - 1 个乘积项，相关值可直接横向比较；
   *    减 1 保证 lag = maxLag + 1 仍在界内，抛物线插值总能取到右邻居。
   * 4) 只取“第一个足够高的局部峰”（MPM 思路）：周期整数倍上的 ACF 同样接近 1，
   *    纯音直接取全局最大值时会随机落到某个倍周期上，产生八度错误。
   * 5) 在可容纳的 m 个整周期处做精化：lag 量化误差与 ACF 波纹造成的峰位偏移都按 1/m 缩小。
   * 6) 最后做抛物线插值，把精度细化到亚 lag 级。
   *
   * @returns 频率(Hz)；无有效基频（能量为零 / 相关度不足）时返回 -1。
   */
  private detectPitch(buffer: Float32Array, sampleRate: number): number {
    if (!(sampleRate > 0) || buffer.length < this.decimationFactor * 8) return -1;

    const frame = this.decimateTo(buffer);
    const analysisRate = sampleRate / this.decimationFactor;
    const frameLength = frame.length;
    const minLag = Math.max(1, Math.floor(analysisRate / this.maxDetectFrequency));
    const maxLag = Math.floor(analysisRate / this.minSearchFrequency);
    const windowLength = frameLength - maxLag - 1;
    if (maxLag <= minLag || windowLength < 4) return -1;

    if (this.correlation.length < maxLag + 2) {
      this.correlation = new Float32Array(maxLag + 2);
    }
    const acf = this.correlation;

    // lag 0 的能量；与各 lag 使用同一个窗口，故可直接作为归一化分母
    let energy = 0;
    for (let j = 0; j < windowLength; j++) {
      energy += frame[j] * frame[j];
    }
    if (!(energy > 0)) return -1;

    // 先存原始相关和（每个 lag 一次除法也没有），最后只归一化一次
    const firstLag = Math.max(0, minLag - 1);
    for (let lag = firstLag; lag <= maxLag + 1; lag++) {
      let sum = 0;
      for (let j = 0; j < windowLength; j++) {
        sum += frame[j] * frame[j + lag];
      }
      acf[lag] = sum;
    }

    let bestLag = minLag;
    let bestValue = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (acf[lag] > bestValue) {
        bestValue = acf[lag];
        bestLag = lag;
      }
    }
    if (!(bestValue > 0) || bestValue / energy < this.correlationThreshold) return -1;

    let fundamentalLag = bestLag;
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (acf[lag] >= acf[lag - 1] && acf[lag] >= acf[lag + 1]
        && acf[lag] >= this.peakThreshold * bestValue) {
        fundamentalLag = lag;
        break;
      }
    }

    let multiple = 1;
    let refinedLag = fundamentalLag;
    const maxMultiple = Math.min(this.maxRefineMultiple, Math.floor(maxLag / fundamentalLag));
    if (maxMultiple >= 2) {
      const center = maxMultiple * fundamentalLag;
      const halfWidth = Math.max(1, Math.round(fundamentalLag / 2) - 1);
      const from = Math.max(minLag, center - halfWidth);
      const to = Math.min(maxLag, center + halfWidth);
      let peakLag = center;
      let peakValue = -Infinity;
      for (let lag = from; lag <= to; lag++) {
        if (acf[lag] > peakValue) {
          peakValue = acf[lag];
          peakLag = lag;
        }
      }
      if (peakValue >= this.periodPeakThreshold * acf[fundamentalLag]) {
        refinedLag = peakLag;
        multiple = maxMultiple;
      }
    }

    // 抛物线插值：δ = 0.5 * (y₋ - y₊) / (y₋ - 2y₀ + y₊)；离散极大值处分母必然 ≤ 0
    const left = acf[refinedLag - 1];
    const centerValue = acf[refinedLag];
    const right = acf[refinedLag + 1];
    const denominator = left - 2 * centerValue + right;
    let refined = refinedLag;
    if (denominator < 0) {
      const offset = (0.5 * (left - right)) / denominator;
      if (offset > -1 && offset < 1) {
        refined = refinedLag + offset;
      }
    }
    if (!(refined > 0)) return -1;
    return (analysisRate * multiple) / refined;
  }
  /**
   * @param frequency detectPitch 的检测结果(Hz)
   * @param rms 同一帧、同一份时域数据的 RMS（由 updatePitch 计算并传入，这里不再采样）
   */
  private processFrequency(frequency: number, rms: number) {
    // isLowVolume 在任何提前 return 之前刷新，因此不存在“停留在上一帧”的分支
    this.isLowVolume = rms < this.rmsThreshold;

    if (!Number.isFinite(frequency) || frequency < 20 || frequency > 2000) return;

    const targetString = this.guitarStrings.find(s => s.note === this.currentString);
    if (!targetString) return;

    this.lastFrequencies.push(frequency);
    if (this.lastFrequencies.length > this.frequencyBufferSize) {
      this.lastFrequencies.shift();
    }

    let frequencySum = 0;
    for (let i = 0; i < this.lastFrequencies.length; i++) {
      frequencySum += this.lastFrequencies[i];
    }
    const avgFrequency = frequencySum / this.lastFrequencies.length;
    // 显示用的“检测音”在这里更新：即使下面的归属判定失败、指针不动，显示仍是实际听到的音
    this.detectedFrequency = avgFrequency;

    // 弦归属：检测音高离哪根标准弦最近。归给**选中的**弦是无条件的（它就是参照系）；
    // 归给**别的**弦则要求确实落在那根弦附近（otherStringCents 内），
    // 否则“选 E2 却弹高 300¢”会被误判成“在弹 A2”，把真实的走音掩盖掉。
    const nearest = this.nearestStandardString(avgFrequency);
    const isOtherString = nearest.note !== this.currentString && nearest.cents <= this.otherStringCents;
    this.detectedString = isOtherString || nearest.note === this.currentString ? nearest.note : '';

    if (isOtherString) {
      // 弹的是别的弦：指针置中并变暗，由状态行说明是哪根弦。
      // 以前这里按 ratio 算出约 +500¢ 并把指针钉死在端点，看起来像“极度偏高”。
      this.lastCents = 0;
      this.tuningPosition = 50;
      return;
    }

    const cents = this.calculateCents(avgFrequency, targetString.freq);
    this.lastCents = this.lastCents * this.centsSmoothingFactor + cents * (1 - this.centsSmoothingFactor);
    // 将±400音分映射到0-100的位置范围
    this.tuningPosition = Math.max(0, Math.min(100, 50 + (this.lastCents / 400) * 50));
  }
  /**
   * 检测频率最接近的标准弦，以及两者的音分距离。
   *
   * 必须用音分距离而不是频率比值来判断：吉他相邻弦相差四度(≈500¢)，用 ratio 判断时
   * “弹 A2 而选中 E2”的比值是 1.33，落进原来的 [0.5, 2] 门限里，于是被当成“E2 高了 500¢”。
   */
  private nearestStandardString(frequency: number): { note: string; cents: number } {
    let bestNote = this.guitarStrings[0].note;
    let bestCents = Number.POSITIVE_INFINITY;
    for (const string of this.guitarStrings) {
      const distance = Math.abs(this.calculateCents(frequency, string.freq));
      if (distance < bestCents) {
        bestCents = distance;
        bestNote = string.note;
      }
    }
    return { note: bestNote, cents: bestCents };
  }
  /** 频率 → 音名（如 82.41 → "E2"）；超出合理范围时回退到目标弦。 */
  private frequencyToNoteName(frequency: number): string {
    if (!Number.isFinite(frequency) || frequency <= 0) return this.currentNote;
    const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440));
    if (midiNote < 0 || midiNote > 127) return this.currentNote;
    const octave = Math.floor(midiNote / 12) - 1;
    return TunerComponent.noteNames[midiNote % 12] + octave;
  }
  private calculateCents(frequency: number, targetFrequency: number): number {
    return 1200 * Math.log2(frequency / targetFrequency);
  }
}