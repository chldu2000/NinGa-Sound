import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    // AppComponent reads localStorage in ngOnInit, and writes to document.body in
    // applyTheme(). Reset both so every spec starts from a known state.
    localStorage.clear();
    document.body.classList.remove('dark-theme');

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      // The template uses routerLink / routerLinkActive / router-outlet, so the
      // standalone component needs a router context. Without it Angular throws:
      // NullInjectorError: No provider for ActivatedRoute!
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
    document.body.classList.remove('dark-theme');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'NingaSound' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('NingaSound');
  });

  it('should start in Chinese with the light theme when nothing is stored', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app.isEnglish).toBeFalse();
    expect(app.isDarkTheme).toBeFalse();
    expect(localStorage.getItem('language')).toBeNull();
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('should render the translated app title in the sidebar h1', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement | null;
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toContain('您吉响');
  });

  it('should toggle the theme, apply it to the body and persist it', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    app.toggleTheme();
    expect(app.isDarkTheme).toBeTrue();
    expect(document.body.classList.contains('dark-theme')).toBeTrue();
    expect(localStorage.getItem('theme')).toEqual('dark');

    app.toggleTheme();
    expect(app.isDarkTheme).toBeFalse();
    expect(document.body.classList.contains('dark-theme')).toBeFalse();
    expect(localStorage.getItem('theme')).toEqual('light');
  });

  it('should toggle the language, persist it and re-render the translated title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    app.toggleLanguage();
    expect(app.isEnglish).toBeTrue();
    expect(localStorage.getItem('language')).toEqual('en');

    fixture.detectChanges();
    let h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(h1.textContent).toContain('NinGaSound');

    app.toggleLanguage();
    expect(app.isEnglish).toBeFalse();
    expect(localStorage.getItem('language')).toEqual('zh');

    fixture.detectChanges();
    h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(h1.textContent).toContain('您吉响');
  });

  it('should restore the stored theme and language on init', () => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('language', 'en');

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.isDarkTheme).toBeTrue();
    expect(document.body.classList.contains('dark-theme')).toBeTrue();
    expect(app.isEnglish).toBeTrue();

    const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(h1.textContent).toContain('NinGaSound');
  });

  it('should treat a stored light theme as light', () => {
    localStorage.setItem('theme', 'light');

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    expect(app.isDarkTheme).toBeFalse();
    expect(document.body.classList.contains('dark-theme')).toBeFalse();
  });
});
