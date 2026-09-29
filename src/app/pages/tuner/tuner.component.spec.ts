import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TunerComponent } from './tuner.component';

/** One sample of the synthetic input signal, addressed by absolute sample index. */
type Signal = (sampleIndex: number, sampleRate: number) => number;

const SAMPLE_RATE = 48000;
const AMPLITUDE = 0.5;
const SILENCE: Signal = () => 0;

function sine(frequency: number, amplitude = AMPLITUDE): Signal {
  return (sampleIndex, sampleRate) =>
    amplitude * Math.sin((2 * Math.PI * frequency * sampleIndex) / sampleRate);
}

/** Fundamental + 2nd + 3rd harmonic (normalised), i.e. what a plucked string actually looks like. */
function harmonics(fundamental: number): Signal {
  return (sampleIndex, sampleRate) => {
    const w = (2 * Math.PI * fundamental * sampleIndex) / sampleRate;
    return (AMPLITUDE * (Math.sin(w) + 0.5 * Math.sin(2 * w) + 0.25 * Math.sin(3 * w))) / 1.75;
  };
}

/**
 * Deterministic pseudo-noise: `Math.random()` would make a failure impossible to reproduce, and the
 * point of this signal is to be a stable regression input, not a realistic one.
 */
function pseudoNoise(sampleIndex: number): number {
  const x = Math.sin(sampleIndex * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function noisySine(frequency: number, noiseAmplitude: number): Signal {
  return (sampleIndex, sampleRate) => sine(frequency)(sampleIndex, sampleRate) + noiseAmplitude * pseudoNoise(sampleIndex);
}

const microphoneTracks: { stop: jasmine.Spy }[] = [];

class MockAnalyserNode {
  /** Overwritten by the component (4096); the default only matters before `startTuner()` runs. */
  fftSize = 2048;
  signal: Signal = SILENCE;
  private cursor = 0;

  constructor(private readonly sampleRate: number) {}

  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }

  reset(): void {
    this.cursor = 0;
  }

  getFloatTimeDomainData(target: Float32Array): void {
    const start = this.cursor;
    for (let i = 0; i < target.length; i += 1) {
      target[i] = this.signal(start + i, this.sampleRate);
    }
    this.cursor += target.length;
  }

  connect(_destination: unknown): void {
    // no-op
  }

  disconnect(): void {
    // no-op
  }
}

class MockTunerAudioContext {
  static instances: MockTunerAudioContext[] = [];

  readonly sampleRate = SAMPLE_RATE;
  readonly destination = { name: 'mock-destination' };
  state = 'running';
  closeCalls = 0;
  readonly analyser: MockAnalyserNode;
  readonly sourceConnections: unknown[] = [];

  constructor() {
    this.analyser = new MockAnalyserNode(this.sampleRate);
    MockTunerAudioContext.instances.push(this);
  }

  createMediaStreamSource(_stream: unknown): { connect: (destination: unknown) => void; disconnect: () => void } {
    return {
      connect: (destination: unknown) => {
        this.sourceConnections.push(destination);
      },
      disconnect: () => undefined
    };
  }

  createAnalyser(): MockAnalyserNode {
    return this.analyser;
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    return Promise.resolve();
  }
}

/** Replaces an own property of a global object and returns a function that restores it. */
function replaceProperty(target: object, name: string, value: unknown): () => void {
  const original = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { value, writable: true, configurable: true });
  return () => {
    if (original) {
      Object.defineProperty(target, name, original);
    } else {
      Reflect.deleteProperty(target, name);
    }
  };
}

/** The private analysis surface, reached only through a cast so the implementation stays untouched. */
interface TunerInternals {
  readonly decimationFactor: number;
  detectPitch(buffer: Float32Array, sampleRate: number): number;
  updatePitch(): void;
  stopTuner(): void;
  processFrequency(frequency: number, rms: number): void;
  detectedFrequency: number;
  lastFrequencies: number[];
  lastCents: number;
}

function internals(component: TunerComponent): TunerInternals {
  return component as unknown as TunerInternals;
}

function centsBetween(detected: number, expected: number): number {
  return 1200 * Math.log2(detected / expected);
}

/**
 * Detection tolerance, in cents (100 cents = one semitone; 5-10 cents is the commonly cited
 * just-noticeable difference for a sustained tone, so these bounds stay musically meaningful).
 *
 * Measured by this very spec against the current implementation, worst case of four frame phases at
 * 48 kHz with 4096-sample frames:
 *   - pure sine: 5.150 cents at E2 (82.41 Hz); every other string <= 2.317 cents
 *   - harmonic-rich (fundamental + 2nd + 3rd): 1.672 cents at E2; A2 0.251 cents
 *   - E2 plus ~22 dB SNR pseudo-noise: 5.165 cents, i.e. dominated by the same E2 bias the pure
 *     sine shows, not by the noise itself
 * The E2 figure is consistent with T4's Node harness, which measured ~4.12 cents worst case for a
 * single pure-sine frame of E2 at 48 kHz and 2.10 cents worst case on harmonic/noisy input; the
 * difference is the frame phase, which is why the accuracy tests sweep four offsets.
 *
 * Every bound sits just above the measured worst case for its signal class, so a regression of more
 * than about a cent fails while the algorithm's own quantisation error does not.
 */
const PURE_SINE_TOLERANCE_CENTS = 6;
const HARMONIC_TOLERANCE_CENTS = 3;
const NOISY_TOLERANCE_CENTS = 6;

describe('TunerComponent', () => {
  let fixture!: ComponentFixture<TunerComponent>;
  let component!: TunerComponent;
  let rafCallbacks: FrameRequestCallback[];
  let getUserMedia!: jasmine.Spy;
  let restoreAudioContext!: () => void;
  let restoreMediaDevices!: () => void;
  let restoreRequestAnimationFrame!: () => void;

  beforeEach(async () => {
    MockTunerAudioContext.instances = [];
    microphoneTracks.length = 0;
    rafCallbacks = [];

    restoreAudioContext = replaceProperty(window, 'AudioContext', MockTunerAudioContext);

    getUserMedia = jasmine.createSpy('getUserMedia').and.callFake(() => {
      const track = { stop: jasmine.createSpy('track.stop') };
      microphoneTracks.push(track);
      return Promise.resolve({ getTracks: () => [track] } as unknown as MediaStream);
    });
    restoreMediaDevices = replaceProperty(navigator, 'mediaDevices', { getUserMedia });

    // requestAnimationFrame is captured instead of executed: the analysis loop must stay under the
    // test's control (one frame per explicit call), otherwise it would run forever in the browser.
    restoreRequestAnimationFrame = replaceProperty(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });

    await TestBed.configureTestingModule({ imports: [TunerComponent] }).compileComponents();

    fixture = TestBed.createComponent(TunerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
    restoreRequestAnimationFrame();
    restoreMediaDevices();
    restoreAudioContext();
  });

  function currentContext(): MockTunerAudioContext {
    const contexts = MockTunerAudioContext.instances;
    return contexts[contexts.length - 1];
  }

  function currentAnalyser(): MockAnalyserNode {
    return currentContext().analyser;
  }

  /** Starts the microphone pipeline with `signal` and processes exactly one frame of it. */
  async function listenTo(signal: Signal): Promise<void> {
    await component.toggleTuner();
    const analyser = currentAnalyser();
    analyser.signal = signal;
    analyser.reset();
    internals(component).updatePitch();
  }

  /** Allocates the reused analysis buffers the way `startTuner()` does, then goes back to idle. */
  async function prepareDetectionBuffers(): Promise<void> {
    await component.toggleTuner();
    internals(component).stopTuner();
    currentAnalyser().reset();
  }

  /**
   * Runs the private detector on one synthetic frame; the buffer length mirrors the real fftSize.
   * `offset` shifts where the frame starts inside the waveform, i.e. which phase the analysis sees.
   */
  function detect(signal: Signal, sampleRate = SAMPLE_RATE, offset = 0): number {
    const size = currentAnalyser().fftSize;
    const frame = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
      frame[i] = signal(offset + i, sampleRate);
    }
    return internals(component).detectPitch(frame, sampleRate);
  }

  /** Frame start offsets (sample indices) swept by the accuracy tests, i.e. four waveform phases. */
  const FRAME_OFFSETS = [0, 1024, 2048, 3072];

  /**
   * Detection is not phase-independent, so accuracy is asserted over several frame offsets and the
   * worst case is reported in the failure message.
   */
  function worstCents(signal: Signal, expected: number): { cents: number; detected: number; offset: number } {
    let worst = { cents: 0, detected: 0, offset: FRAME_OFFSETS[0] };
    for (const offset of FRAME_OFFSETS) {
      const detected = detect(signal, SAMPLE_RATE, offset);
      expect(detected).withContext(`${expected} Hz at offset ${offset}`).toBeGreaterThan(0);
      const cents = Math.abs(centsBetween(detected, expected));
      if (cents > worst.cents) {
        worst = { cents, detected, offset };
      }
    }
    return worst;
  }

  it('should create with the low E string selected and a centred pointer', () => {
    expect(component.isListening).toBeFalse();
    expect(component.isLowVolume).toBeTrue();
    expect(component.currentString).toBe('E2');
    expect(component.currentNote).toBe('E2');
    expect(component.tuningPosition).toBe(50);
    expect(component.pitchLabels.length).toBe(9);
    expect(component.pitchLabels[0]).toBe('-400\u00A2');
    expect(component.pitchLabels[4]).toBe('0\u00A2');
    expect(component.pitchLabels[8]).toBe('+400\u00A2');
  });

  it('should expose the six standard-tuning strings', () => {
    expect(component.guitarStrings.map((string) => string.note)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(component.guitarStrings.map((string) => string.freq)).toEqual([82.41, 110, 146.83, 196, 246.94, 329.63]);
  });

  it('should render the target note and an inactive centred pointer before listening', () => {
    const note = fixture.nativeElement.querySelector('.note') as HTMLElement | null;
    const pointer = fixture.nativeElement.querySelector('.indicator-pointer') as HTMLElement | null;

    expect(note).not.toBeNull();
    expect(note!.textContent).toContain('E2');
    expect(pointer).not.toBeNull();
    expect(pointer!.style.left).toBe('50%');
    expect(pointer!.classList.contains('active')).toBeFalse();
  });

  describe('pitch detection accuracy', () => {
    beforeEach(async () => {
      await prepareDetectionBuffers();
    });

    for (const expected of [82.41, 110, 146.83, 196, 246.94, 329.63, 440]) {
      it(`should detect a pure ${expected} Hz sine within ${PURE_SINE_TOLERANCE_CENTS} cents`, () => {
        const worst = worstCents(sine(expected), expected);

        expect(worst.cents)
          .withContext(
            `expected ${expected} Hz; worst of offsets ${FRAME_OFFSETS.join(',')} was ` +
              `${worst.detected.toFixed(4)} Hz at offset ${worst.offset} (${worst.cents.toFixed(3)} cents)`
          )
          .toBeLessThanOrEqual(PURE_SINE_TOLERANCE_CENTS);
      });
    }

    for (const expected of [82.41, 110]) {
      it(`should detect the fundamental of a harmonic-rich ${expected} Hz string`, () => {
        const worst = worstCents(harmonics(expected), expected);

        expect(worst.cents)
          .withContext(
            `expected ${expected} Hz; worst of offsets ${FRAME_OFFSETS.join(',')} was ` +
              `${worst.detected.toFixed(4)} Hz at offset ${worst.offset} (${worst.cents.toFixed(3)} cents)`
          )
          .toBeLessThanOrEqual(HARMONIC_TOLERANCE_CENTS);
      });
    }

    it('should detect a noisy low E string within tolerance', () => {
      const expected = 82.41;
      const worst = worstCents(noisySine(expected, 0.05), expected);

      expect(worst.cents)
        .withContext(
          `expected ${expected} Hz; worst of offsets ${FRAME_OFFSETS.join(',')} was ` +
            `${worst.detected.toFixed(4)} Hz at offset ${worst.offset} (${worst.cents.toFixed(3)} cents)`
        )
        .toBeLessThanOrEqual(NOISY_TOLERANCE_CENTS);
    });

    it('should reject frames it cannot analyse', () => {
      expect(detect(SILENCE)).toBe(-1); // no energy at all
      expect(detect(sine(440), 0)).toBe(-1); // no sample rate
      expect(internals(component).detectPitch(new Float32Array(16), SAMPLE_RATE)).toBe(-1); // shorter than a period
    });
  });

  describe('volume gating and stale state', () => {
    it('should flag a fully silent input as low volume', async () => {
      await listenTo(SILENCE);

      expect(component.isListening).toBeTrue();
      expect(component.isLowVolume).toBeTrue();
      expect(component.displayNote).toBe('E2'); // the target string, never a stale detection
    });

    it('should clear isLowVolume while a string is sounding', async () => {
      await listenTo(sine(82.41));

      expect(component.isLowVolume).toBeFalse();
      expect(component.displayNote).toBe('E2');
    });

    it('should flip isLowVolume back to true when a loud string stops (stale-state regression)', async () => {
      await listenTo(sine(82.41));
      expect(component.isLowVolume).toBeFalse();
      expect(internals(component).detectedFrequency).toBeGreaterThan(0); // there *is* a stale detection to clear

      currentAnalyser().signal = SILENCE;
      internals(component).updatePitch();

      expect(component.isLowVolume).toBeTrue();
      // The stale detection must not survive into the display either.
      expect(component.displayNote).toBe('E2');
    });

    it('should flip isLowVolume to false again when the sound comes back', async () => {
      await listenTo(SILENCE);
      expect(component.isLowVolume).toBeTrue();

      currentAnalyser().signal = sine(110);
      internals(component).updatePitch();

      expect(component.isLowVolume).toBeFalse();
    });

    it('should display the detected note while keeping the target string for the pointer', async () => {
      await listenTo(sine(110)); // an A2 is sounding while the E2 string is selected

      expect(component.currentString).toBe('E2');
      expect(component.currentNote).toBe('E2');
      expect(component.displayNote).toBe('A2');

      fixture.detectChanges();
      const note = fixture.nativeElement.querySelector('.note') as HTMLElement | null;
      expect(note!.textContent).toContain('A2');
    });

    it('should fall back to the target string when the sound stops', async () => {
      await listenTo(sine(110));
      expect(component.displayNote).toBe('A2');

      currentAnalyser().signal = SILENCE;
      internals(component).updatePitch();

      expect(component.displayNote).toBe('E2');
    });

    it('should activate the pointer only while a loud string is detected', async () => {
      await listenTo(sine(82.41));
      fixture.detectChanges();
      let pointer = fixture.nativeElement.querySelector('.indicator-pointer') as HTMLElement | null;
      expect(pointer!.classList.contains('active')).toBeTrue();

      currentAnalyser().signal = SILENCE;
      internals(component).updatePitch();
      fixture.detectChanges();
      pointer = fixture.nativeElement.querySelector('.indicator-pointer') as HTMLElement | null;
      expect(pointer!.classList.contains('active')).toBeFalse();
    });
  });

  describe('cents to pointer mapping', () => {
    beforeEach(async () => {
      await prepareDetectionBuffers();
      component.selectString('E2');
    });

    /**
     * Feeds one frame whose deviation is exactly `cents`.
     *
     * `lastCents` is pre-set to `cents` on purpose: the smoothing in `processFrequency` is a linear
     * filter whose fixed point is the incoming value, so a steady-state string is exactly what the
     * component converges to — presetting it removes the need for fifty identical frames and makes
     * the expected pointer position exact instead of "close to the clamp".
     */
    function feed(cents: number, targetFrequency = 82.41, initialCents = cents): void {
      const state = internals(component);
      state.lastCents = initialCents;
      state.lastFrequencies = [];
      state.processFrequency(targetFrequency * Math.pow(2, cents / 1200), 0.5);
    }

    it('should map 0 cents to the centre of the scale', () => {
      feed(0);
      expect(internals(component).lastCents).toBeCloseTo(0, 6);
      expect(component.tuningPosition).toBeCloseTo(50, 6);
    });

    it('should map +400 cents to 100 and -400 cents to 0', () => {
      feed(400);
      expect(component.tuningPosition).toBeCloseTo(100, 6);

      feed(-400);
      expect(component.tuningPosition).toBeCloseTo(0, 6);
    });

    it('should clamp deviations beyond the +/-400 cents scale', () => {
      feed(800);
      expect(component.tuningPosition).toBe(100);

      feed(-800);
      expect(component.tuningPosition).toBe(0);
    });

    /**
     * ±400¢ is deliberately not used here. A fourth is 500¢, so for the G3/B3 pair +400¢ lands
     * exactly on the neighbouring standard string (G3 + 400¢ == B3) and the tuner reports a wrong
     * string instead of a pointer position; that collision has its own case below. ±200¢ stays
     * unambiguously inside every string's own region (the neighbour is 500¢ away), so the linear
     * mapping is asserted there.
     */
    it('should keep the same mapping for all six strings', () => {
      for (const string of component.guitarStrings) {
        component.selectString(string.note);

        feed(0, string.freq, 0);
        expect(component.tuningPosition).withContext(`${string.note} at 0 cents`).toBeCloseTo(50, 6);

        feed(200, string.freq, 200);
        expect(component.tuningPosition).withContext(`${string.note} at +200 cents`).toBeCloseTo(75, 6);

        feed(-200, string.freq, -200);
        expect(component.tuningPosition).withContext(`${string.note} at -200 cents`).toBeCloseTo(25, 6);
      }
    });

    it('should report a wrong string instead of pegging the pointer when the pitch is another string', () => {
      // G3 + 400 cents is exactly B3: both are standard strings a major third apart, so the pitch
      // genuinely belongs to B3 and the tuner has to say so rather than slamming the pointer right.
      component.selectString('G3');
      feed(400, 196.0, 400);
      expect(component.detectedString).toBe('B3');
      expect(component.isOtherStringDetected).toBeTrue();
      expect(component.tuningPosition).toBe(50);

      // The mirror case: a major third below B3 is exactly G3.
      component.selectString('B3');
      feed(-400, 246.94, -400);
      expect(component.detectedString).toBe('G3');
      expect(component.isOtherStringDetected).toBeTrue();
      expect(component.tuningPosition).toBe(50);
    });

    it('should keep a badly detuned selected string on the pointer', () => {
      // 300 cents sharp is still the low E string, not A2: A2 is merely the nearest string
      // (200 cents away), which is why attribution also requires the +/-50 cent tolerance.
      component.selectString('E2');
      feed(300, 82.41, 300);
      expect(component.detectedString).toBe('');
      expect(component.isOtherStringDetected).toBeFalse();
      expect(component.tuningPosition).toBeCloseTo(87.5, 6);
    });

    it('should ignore frequencies outside the plausible range', () => {
      const state = internals(component);
      state.lastFrequencies = [];
      state.processFrequency(5000, 0.5); // above the 2000 Hz ceiling
      expect(component.tuningPosition).toBe(50);

      state.processFrequency(Number.NaN, 0.5);
      expect(component.tuningPosition).toBe(50);
    });
  });

  describe('target string selection and teardown', () => {
    it('should drop the previous detection from the display when another string is selected', async () => {
      await listenTo(sine(110));
      expect(component.displayNote).toBe('A2');

      component.selectString('D3');

      expect(component.currentString).toBe('D3');
      expect(component.currentNote).toBe('D3');
      expect(internals(component).detectedFrequency).toBe(0);
      expect(component.displayNote).toBe('D3');
    });

    it('should stop the microphone, close the context and recentre the pointer', async () => {
      // A slightly sharp low E: the selected string is E2, so this is a real deviation rather than
      // another string. (Playing A2 while E2 is selected no longer moves the pointer at all --
      // that is the wrong-string case, covered separately.)
      await listenTo(sine(82.41 * Math.pow(2, 30 / 1200)));
      expect(component.tuningPosition).not.toBe(50);

      internals(component).stopTuner();

      expect(component.isListening).toBeFalse();
      expect(component.tuningPosition).toBe(50);
      expect(component.isLowVolume).toBeTrue();
      expect(internals(component).detectedFrequency).toBe(0);
      expect(microphoneTracks.length).toBe(1);
      expect(microphoneTracks[0].stop).toHaveBeenCalled();
      expect(currentContext().closeCalls).toBe(1);
    });

    it('should stop the tuner on destroy', async () => {
      await listenTo(sine(82.41));
      expect(component.isListening).toBeTrue();

      component.ngOnDestroy();

      expect(component.isListening).toBeFalse();
      expect(microphoneTracks[0].stop).toHaveBeenCalled();
    });

    it('should keep the analysis loop alive by re-arming requestAnimationFrame', async () => {
      await listenTo(SILENCE);
      const queued = rafCallbacks.length;
      expect(queued).toBeGreaterThan(0);

      rafCallbacks[queued - 1](0);

      expect(rafCallbacks.length).toBe(queued + 1);
    });

    it('should not start listening when the microphone is unavailable', async () => {
      const consoleError = spyOn(console, 'error');
      getUserMedia.and.returnValue(Promise.reject(new Error('NotAllowedError')));

      await component.toggleTuner();

      expect(component.isListening).toBeFalse();
      expect(consoleError).toHaveBeenCalled();
    });
  });

  /**
   * The tuner used to fail silently: no microphone error was shown, no hint when the input was
   * too quiet, no confirmation when the string was in tune, and no explanation when the pitch
   * belonged to a different string. These cases pin the replacement behaviour down.
   */
  describe('status feedback (previously silent failures)', () => {
    function statusElement(): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="tuner-status"]') as HTMLElement;
    }

    /** The rendered status text, with the non-breaking separator normalised to a plain space. */
    function statusText(): string {
      return (statusElement().textContent ?? '').replace(/\u00a0/g, ' ').trim();
    }

    it('should tell the user to start while the tuner is idle', () => {
      fixture.detectChanges();
      expect(component.statusKey).toBe('tuner_idle');
      expect(statusText()).toContain('开始调音');
    });

    it('should ask for a louder signal while the input is too quiet', async () => {
      await listenTo(SILENCE);
      fixture.detectChanges();

      expect(component.isLowVolume).toBeTrue();
      expect(component.statusKey).toBe('tuner_too_quiet');
      expect(statusText()).toContain('音量太低');
    });

    it('should confirm explicitly when the selected string is in tune', async () => {
      await listenTo(sine(82.41));
      fixture.detectChanges();

      expect(component.isInTune).toBeTrue();
      expect(component.statusKey).toBe('tuner_in_tune');
      expect(statusText()).toContain('已调准');
      const note = fixture.nativeElement.querySelector('.note') as HTMLElement;
      expect(note.classList.contains('in-tune')).toBeTrue();
      expect(statusElement().classList.contains('status-in-tune')).toBeTrue();
    });

    it('should say flat or sharp while the selected string is off pitch', async () => {
      await listenTo(sine(82.41 * Math.pow(2, -30 / 1200)));
      expect(component.isInTune).toBeFalse();
      expect(component.statusKey).toBe('tuner_flat');

      // Selecting the same string again clears the smoothing state, so the sign is unambiguous.
      component.selectString('E2');
      currentAnalyser().signal = sine(82.41 * Math.pow(2, 30 / 1200));
      internals(component).updatePitch();

      expect(component.statusKey).toBe('tuner_sharp');
    });

    it('should name the string being played instead of pegging the pointer', async () => {
      await listenTo(sine(110));
      fixture.detectChanges();

      expect(component.currentString).toBe('E2');
      expect(component.detectedString).toBe('A2');
      expect(component.isOtherStringDetected).toBeTrue();
      expect(component.isTargetStringDetected).toBeFalse();
      expect(component.tuningPosition).toBe(50);

      const pointer = fixture.nativeElement.querySelector('.indicator-pointer') as HTMLElement;
      expect(pointer.classList.contains('active')).toBeFalse();

      expect(component.statusKey).toBe('tuner_wrong_string');
      expect(statusText()).toContain('A2');
      expect(statusText()).toContain('不是当前选中的弦');
    });

    it('should mark which string is actually sounding without changing the target', async () => {
      await listenTo(sine(110));
      fixture.detectChanges();

      const marked = fixture.nativeElement.querySelectorAll('.string.detected');
      expect(marked.length).toBe(1);
      expect((marked[0] as HTMLElement).getAttribute('data-note')).toBe('A2');

      const active = fixture.nativeElement.querySelector('.string.active') as HTMLElement;
      expect(active.getAttribute('data-note')).toBe('E2');
      expect(component.currentString).toBe('E2');
    });

    it('should accept the sounding string once the user selects it', async () => {
      await listenTo(sine(110));
      component.selectString('A2');
      internals(component).updatePitch();
      fixture.detectChanges();

      expect(component.isOtherStringDetected).toBeFalse();
      expect(component.isTargetStringDetected).toBeTrue();
      expect(component.isInTune).toBeTrue();

      const pointer = fixture.nativeElement.querySelector('.indicator-pointer') as HTMLElement;
      expect(pointer.classList.contains('active')).toBeTrue();
    });

    it('should drop the stale frequency window when another string is selected', async () => {
      await listenTo(sine(110));
      expect(internals(component).lastFrequencies.length).toBeGreaterThan(0);

      component.selectString('D3');

      // Without clearing the window, the first frames after a switch would average the previous
      // string's samples in and briefly attribute the pitch to the old string.
      expect(internals(component).lastFrequencies.length).toBe(0);
      expect(component.detectedString).toBe('');
      expect(component.tuningPosition).toBe(50);
    });
  });

  describe('microphone failures are reported instead of swallowed', () => {
    function rejectWith(name: string): void {
      const error = new Error(name);
      error.name = name;
      getUserMedia.and.returnValue(Promise.reject(error));
    }

    function allowAgain(): void {
      getUserMedia.and.callFake(() => {
        const track = { stop: jasmine.createSpy('track.stop') };
        microphoneTracks.push(track);
        return Promise.resolve({ getTracks: () => [track] } as unknown as MediaStream);
      });
    }

    it('should explain a denied permission in the UI', async () => {
      const consoleError = spyOn(console, 'error');
      rejectWith('NotAllowedError');

      await component.toggleTuner();
      fixture.detectChanges();

      expect(component.isListening).toBeFalse();
      expect(component.micError).toBe('denied');
      expect(component.statusKey).toBe('mic_denied');

      const status = fixture.nativeElement.querySelector('[data-testid="tuner-status"]') as HTMLElement;
      expect(status.textContent).toContain('麦克风权限被拒绝');
      expect(status.classList.contains('status-error')).toBeTrue();
      // Diagnostics are still logged; the point is that the UI is no longer silent.
      expect(consoleError).toHaveBeenCalled();
    });

    it('should tell a missing device apart from a busy one', async () => {
      spyOn(console, 'error');

      rejectWith('NotFoundError');
      await component.toggleTuner();
      expect(component.micError).toBe('no-device');
      expect(component.micErrorKey).toBe('mic_no_device');

      rejectWith('NotReadableError');
      await component.toggleTuner();
      expect(component.micError).toBe('busy');
      expect(component.micErrorKey).toBe('mic_busy');
    });

    it('should fall back to a generic message for an unrecognised failure', async () => {
      spyOn(console, 'error');
      rejectWith('WeirdError');

      await component.toggleTuner();

      expect(component.micError).toBe('unknown');
      expect(component.statusKey).toBe('mic_unknown');
    });

    it('should report an unusable environment when mediaDevices is missing', async () => {
      const restore = replaceProperty(navigator, 'mediaDevices', undefined);
      try {
        await component.toggleTuner();
        expect(component.micError).toBe('insecure');
        expect(component.statusKey).toBe('mic_insecure');
        expect(component.isListening).toBeFalse();
      } finally {
        restore();
      }
    });

    it('should not leak an AudioContext when the microphone cannot be opened', async () => {
      spyOn(console, 'error');
      rejectWith('NotAllowedError');

      await component.toggleTuner();

      // The context was created before getUserMedia rejected; it must be closed again, otherwise
      // every retry leaves one behind.
      expect(currentContext().closeCalls).toBe(1);
    });

    it('should clear the error once a retry succeeds', async () => {
      spyOn(console, 'error');
      rejectWith('NotAllowedError');
      await component.toggleTuner();
      expect(component.micError).toBe('denied');

      allowAgain();
      await component.toggleTuner();

      expect(component.micError).toBe('');
      expect(component.isListening).toBeTrue();
      expect(component.statusKey).not.toBe('mic_denied');
    });
  });
});
