import { Routes } from '@angular/router';
import { MetronomeComponent } from './pages/metronome/metronome.component';
import { TunerComponent } from './pages/tuner/tuner.component';

export const routes: Routes = [
  { path: 'metronome', component: MetronomeComponent },
  { path: 'tuner', component: TunerComponent },
  { path: '', redirectTo: '/metronome', pathMatch: 'full' }
];
