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
    /* T9: 需要拉伸的是宿主元素 app-footer —— 它才是 .page-container 的 flex 项。
       原来写在 .footer 上的 margin-top: auto 处于普通块级上下文，auto 外边距
       解析为 0（实测 computed margin-top = 0px），短页时页脚悬在内容下方。
       把 auto 外边距放到宿主上即可吸收剩余空间，使页脚贴到容器底部。 */
    :host {
      display: block;
      margin-top: auto;
    }
    .footer {
      text-align: center;
      padding: 10px;
      font-size: 0.9em;
      color: var(--text-muted);
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