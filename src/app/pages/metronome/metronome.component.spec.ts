import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MetronomeComponent } from './metronome.component';

/**
 * Headless Chrome has no audio device, so every AudioContext the component creates is replaced by
 * this mock. It records the nodes the scheduler asks for and exposes a hand-driven `currentTime`,
 * which is what makes the look-ahead scheduler deterministic in a test: the scheduler only ever
 * reads the audio clock, so moving `currentTime` by hand is exactly what a real audio device would
 * do for us.
 */
class MockAudioParam {
  value = 0;
  readonly setValueAtTime = jasmine.createSpy('gain.setValueAtTime');
  readonly exponentialRampToValueAtTime = jasmine.createSpy('gain.exponentialRampToValueAtTime');
}

class MockOscillatorNode {
  readonly frequency = new MockAudioParam();
  readonly start = jasmine.createSpy('oscillator.start');
  readonly stop = jasmine.createSpy('oscillator.stop');
  readonly connect = jasmine.createSpy('oscillator.connect');
  readonly disconnect = jasmine.createSpy('oscillator.disconnect');
  onended: (() => void) | null = null;
}

class MockGainNode {
  readonly gain = new MockAudioParam();
  readonly connect = jasmine.createSpy('gain.connect');
  readonly disconnect = jasmine.createSpy('gain.disconnect');
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];

  readonly destination = { name: 'mock-destination' };
  readonly sampleRate = 48000;
  /** The audio clock, in seconds. Tests move this to simulate the passage of time. */
  currentTime = 0;
  state = 'running';
  resumeCalls = 0;
  closeCalls = 0;
  readonly oscillators: MockOscillatorNode[] = [];
  readonly gains: MockGainNode[] = [];

  constructor() {
    MockAudioContext.instances.push(this);
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    return Promise.resolve();
  }

  createOscillator(): MockOscillatorNode {
    const node = new MockOscillatorNode();
    this.oscillators.push(node);
    return node;
  }

  createGain(): MockGainNode {
    const node = new MockGainNode();
    this.gains.push(node);
    return node;
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

/** Private scheduler state, read here only to prove that the tempo change did not reset it. */
interface MetronomeInternals {
  nextBeatIndex: number;
  nextNoteTime: number;
  schedulerId: number | undefined;
  visualTimers: number[];
}

function internals(component: MetronomeComponent): MetronomeInternals {
  return component as unknown as MetronomeInternals;
}

/** The component only reads `target.value` from a slider event. */
function slider(value: string): HTMLInputElement {
  return { value } as unknown as HTMLInputElement;
}

function inputEvent(input: HTMLInputElement): Event {
  return { target: input } as unknown as Event;
}

describe('MetronomeComponent', () => {
  let fixture!: ComponentFixture<MetronomeComponent>;
  let component!: MetronomeComponent;
  let restoreAudioContext!: () => void;

  beforeEach(async () => {
    MockAudioContext.instances = [];
    restoreAudioContext = replaceProperty(window, 'AudioContext', MockAudioContext);
    await TestBed.configureTestingModule({ imports: [MetronomeComponent] }).compileComponents();
  });

  afterEach(() => {
    restoreAudioContext();
  });

  function create(): void {
    fixture = TestBed.createComponent(MetronomeComponent);
    component = fixture.componentInstance;
  }

  function currentContext(): MockAudioContext {
    const contexts = MockAudioContext.instances;
    return contexts[contexts.length - 1];
  }

  /**
   * Runs `body` on fake timers and always tears the component down afterwards: the scheduler owns a
   * periodic 25 ms interval, and a leaked one makes fakeAsync itself fail at the end of the spec,
   * which would hide the real assertion failure.
   */
  function metronomeTest(body: (component: MetronomeComponent) => void): () => void {
    return fakeAsync(() => {
      create();
      try {
        body(component);
      } finally {
        component.ngOnDestroy();
      }
    });
  }

  it('should create with the default 4/4 settings', () => {
    create();
    expect(component.bpm).toBe(120);
    expect(component.isPlaying).toBeFalse();
    expect(component.currentPattern).toBe('4/4');
    expect(component.currentBeat).toBe(-1);
    expect(component.beatIndicators).toEqual([1, 2, 3, 4]);
  });

  it('should render the default BPM in the template', () => {
    create();
    fixture.detectChanges();
    const display = fixture.nativeElement.querySelector('.bpm-display') as HTMLElement | null;
    expect(display).not.toBeNull();
    expect(display!.textContent).toContain('120');
  });

  it('should clamp the slider BPM to [30, 300] and mirror the clamp back into the control', () => {
    create();

    const tooSlow = slider('10');
    component.updateBPM(inputEvent(tooSlow));
    expect(component.bpm).toBe(30);
    expect(tooSlow.value).toBe('30');

    const tooFast = slider('500');
    component.updateBPM(inputEvent(tooFast));
    expect(component.bpm).toBe(300);
    expect(tooFast.value).toBe('300');
  });

  it('should keep the previous BPM when the slider value is empty or not a number', () => {
    create();
    component.updateBPM(inputEvent(slider('140')));
    expect(component.bpm).toBe(140);

    for (const value of ['', '   ', 'abc', 'NaN', 'Infinity', '-Infinity', '--']) {
      component.updateBPM(inputEvent(slider(value)));
      expect(component.bpm)
        .withContext(`slider value ${JSON.stringify(value)}`)
        .toBe(140);
    }
  });

  it('should always leave the BPM finite and inside [30, 300] for hostile slider input', () => {
    create();

    const hostileValues = [
      '',
      ' ',
      'NaN',
      'Infinity',
      '-Infinity',
      '1e9',
      '1e-9',
      '0x10',
      '-1',
      '0',
      '301',
      '1000',
      '30.9',
      '299.9999',
      '999999999999999999999',
      '30',
      '300'
    ];

    for (const value of hostileValues) {
      component.updateBPM(inputEvent(slider(value)));
      const context = `slider value ${JSON.stringify(value)} -> bpm ${component.bpm}`;
      expect(Number.isFinite(component.bpm)).withContext(context).toBeTrue();
      expect(component.bpm).withContext(context).toBeGreaterThanOrEqual(30);
      expect(component.bpm).withContext(context).toBeLessThanOrEqual(300);
    }
  });

  it('should clamp +/- steps at both ends and ignore non-finite steps', () => {
    create();

    component.adjustBPM(-1);
    expect(component.bpm).toBe(119);

    component.adjustBPM(-1000);
    expect(component.bpm).toBe(30);

    component.adjustBPM(1000);
    expect(component.bpm).toBe(300);

    component.adjustBPM(Number.NaN);
    expect(component.bpm).toBe(300);

    component.adjustBPM(Number.POSITIVE_INFINITY);
    expect(component.bpm).toBe(300);
  });

  it('should rebuild the beat indicators when the time signature changes', () => {
    create();
    fixture.detectChanges();

    component.selectPattern('3/4');
    fixture.detectChanges();
    expect(component.currentPattern).toBe('3/4');
    expect(component.beatIndicators).toEqual([1, 2, 3]);
    expect(component.currentBeat).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.beat-indicator').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.beat-indicator.active').length).toBe(1);

    component.selectPattern('6/8');
    fixture.detectChanges();
    expect(component.beatIndicators).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fixture.nativeElement.querySelectorAll('.beat-indicator').length).toBe(6);

    component.selectPattern('4/4');
    fixture.detectChanges();
    expect(component.beatIndicators).toEqual([1, 2, 3, 4]);
    expect(fixture.nativeElement.querySelectorAll('.beat-indicator').length).toBe(4);
  });

  it('should not create an AudioContext before the user starts', () => {
    create();
    expect(component.isPlaying).toBeFalse();
    expect(MockAudioContext.instances.length).toBe(0);
  });

  it('should reuse one AudioContext across start/stop cycles', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    metronome.toggleMetronome();
    metronome.toggleMetronome();

    expect(MockAudioContext.instances.length).toBe(1);
    expect(currentContext().resumeCalls).toBe(2);
  }));

  it('should queue the accented downbeat on the audio clock when started', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    expect(metronome.isPlaying).toBeTrue();

    const context = currentContext();
    expect(context.oscillators.length).toBe(1);

    const downbeat = context.oscillators[0];
    expect(downbeat.frequency.value).toBe(1500); // accent pitch
    expect(downbeat.start).toHaveBeenCalledWith(0); // due "now" on the audio clock
    expect(downbeat.stop).toHaveBeenCalledWith(0.05); // CLICK_DURATION_S
    expect(context.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.7, 0);

    tick(0); // the indicator is lit by a 0 ms timer aimed at the audible beat
    expect(metronome.currentBeat).toBe(0);
  }));

  it('should advance one beat per beat interval, wrap the bar and accent beat 1 again', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    const context = currentContext();
    tick(0);
    expect(metronome.currentBeat).toBe(0);

    const advanceTo = (time: number): void => {
      context.currentTime = time;
      tick(25);
      tick(1);
    };

    advanceTo(0.5);
    expect(metronome.currentBeat).toBe(1);
    advanceTo(1.0);
    expect(metronome.currentBeat).toBe(2);
    advanceTo(1.5);
    expect(metronome.currentBeat).toBe(3);
    advanceTo(2.0);
    expect(metronome.currentBeat).toBe(0); // wrapped into the next bar

    expect(context.oscillators.length).toBe(5);
    expect(context.oscillators.map((node) => node.frequency.value)).toEqual([1500, 1000, 1000, 1000, 1500]);
    expect(context.oscillators[4].start).toHaveBeenCalledWith(2);
    expect(internals(metronome).nextBeatIndex).toBe(1);
  }));

  it('should keep the bar phase when the tempo is stepped during playback', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    const context = currentContext();
    const schedulerId = internals(metronome).schedulerId;
    tick(0);

    context.currentTime = 0.5;
    tick(25);
    tick(1);
    expect(metronome.currentBeat).toBe(1);

    const phaseBefore = internals(metronome).nextBeatIndex;
    const dueBefore = internals(metronome).nextNoteTime;
    const scheduledBefore = context.oscillators.length;

    metronome.adjustBPM(60); // 120 -> 180

    expect(metronome.bpm).toBe(180);
    // No restart: same scheduler, same bar phase, no beat queued by the tempo change itself.
    expect(internals(metronome).schedulerId).toBe(schedulerId);
    expect(internals(metronome).nextBeatIndex).toBe(phaseBefore);
    expect(internals(metronome).nextNoteTime).toBe(dueBefore);
    expect(context.oscillators.length).toBe(scheduledBefore);

    // The next beat keeps its bar position and only its spacing reflects the new tempo.
    context.currentTime = dueBefore;
    tick(25);
    tick(1);
    expect(metronome.currentBeat).toBe(2);
    expect(internals(metronome).nextNoteTime).toBeCloseTo(dueBefore + 1 / 3, 6);
  }));

  it('should keep the bar phase when the slider changes the tempo during playback', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    const context = currentContext();
    tick(0);

    context.currentTime = 0.5;
    tick(25);
    tick(1);
    expect(metronome.currentBeat).toBe(1);

    const phaseBefore = internals(metronome).nextBeatIndex;
    const dueBefore = internals(metronome).nextNoteTime;

    const control = slider('90');
    metronome.updateBPM(inputEvent(control));

    expect(metronome.bpm).toBe(90);
    expect(control.value).toBe('90');
    expect(internals(metronome).nextBeatIndex).toBe(phaseBefore);
    expect(internals(metronome).nextNoteTime).toBe(dueBefore);
    expect(context.oscillators.length).toBe(2);
  }));

  it('should re-align to the audio clock instead of firing a burst of late beats', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    const context = currentContext();
    expect(context.oscillators.length).toBe(1);

    context.currentTime = 5; // the poll was throttled; the audio clock moved on
    tick(25);

    expect(context.oscillators.length).toBe(2); // exactly one catch-up beat, not nine
    expect(context.oscillators[1].start).toHaveBeenCalledWith(5);
  }));

  it('should reset currentBeat and stop scheduling when stopped', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    const context = currentContext();
    tick(0);
    expect(metronome.currentBeat).toBe(0);

    metronome.toggleMetronome();
    expect(metronome.isPlaying).toBeFalse();
    expect(metronome.currentBeat).toBe(-1);

    const scheduled = context.oscillators.length;
    context.currentTime = 4;
    tick(500);
    expect(context.oscillators.length).toBe(scheduled);
    expect(metronome.currentBeat).toBe(-1);
    expect(internals(metronome).schedulerId).toBeUndefined();
    expect(internals(metronome).visualTimers).toEqual([]);
  }));

  it('should clear the timers and close the AudioContext on destroy', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    const context = currentContext();
    tick(0);

    metronome.ngOnDestroy();

    expect(context.closeCalls).toBe(1);

    const scheduled = context.oscillators.length;
    context.currentTime = 10;
    tick(1000);
    expect(context.oscillators.length).toBe(scheduled);
    expect(metronome.currentBeat).toBe(-1);
  }));

  it('should restart the bar when the time signature changes during playback', metronomeTest((metronome) => {
    metronome.toggleMetronome();
    const context = currentContext();
    tick(0);

    const advanceTo = (time: number): void => {
      context.currentTime = time;
      tick(25);
      tick(1);
    };
    advanceTo(0.5);
    advanceTo(1.0);
    advanceTo(1.5);
    expect(metronome.currentBeat).toBe(3);
    expect(context.oscillators.length).toBe(4);

    metronome.selectPattern('6/8');

    expect(metronome.currentPattern).toBe('6/8');
    expect(metronome.beatIndicators).toEqual([1, 2, 3, 4, 5, 6]);
    expect(context.oscillators.length).toBe(5); // the new downbeat is queued immediately
    expect(context.oscillators[4].frequency.value).toBe(1500);
    expect(context.oscillators[4].start).toHaveBeenCalledWith(1.5);
    expect(internals(metronome).nextBeatIndex).toBe(1);

    tick(0);
    expect(metronome.currentBeat).toBe(0); // phase restarted on purpose
  }));
});
