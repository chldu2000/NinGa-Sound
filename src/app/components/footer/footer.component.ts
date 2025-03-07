import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer">
      Developed with <a href="https://www.trae.ai/" target="_blank" rel="noopener noreferrer">Trae</a>
    </footer>
  `,
  styles: [`
    .footer {
      text-align: center;
      padding: 10px;
      margin-top: auto;
      font-size: 0.9em;
      color: #666;
    }
    .footer a {
      color: var(--guitar-sunset-dark);
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  `]
})
export class FooterComponent {}