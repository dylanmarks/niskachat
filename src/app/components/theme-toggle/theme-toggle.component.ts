import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Theme, ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
})
export class ThemeToggleComponent {
  @Input() showLabel = false;
  @Input() variant: 'icon' | 'button' | 'menu' = 'icon';

  constructor(public themeService: ThemeService) {}

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  getThemeIcon(theme: Theme): string {
    switch (theme) {
      case 'light':
        return 'light_mode';
      case 'dark':
        return 'dark_mode';
      case 'system':
        return 'settings_brightness';
      default:
        return 'settings_brightness';
    }
  }

  getThemeLabel(theme: Theme): string {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
      default:
        return 'System';
    }
  }

  getCurrentThemeIcon(): string {
    return this.getThemeIcon(this.themeService.selectedTheme());
  }

  getCurrentThemeLabel(): string {
    return this.getThemeLabel(this.themeService.selectedTheme());
  }

  getTooltipText(): string {
    const current = this.getCurrentThemeLabel();
    const effective = this.themeService.isDarkMode() ? 'Dark' : 'Light';

    if (current === 'System') {
      return `Theme: ${current} (${effective})`;
    }
    return `Theme: ${current}`;
  }
}
