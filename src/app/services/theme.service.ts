import { computed, effect, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'niska-theme';

  // Reactive signals for theme management - light mode only
  private readonly _selectedTheme = signal<Theme>('light');
  private readonly _systemTheme = signal<'light' | 'dark'>('light');

  // Computed signal for the effective theme (always light)
  readonly effectiveTheme = computed(() => 'light' as const);

  // Public getters
  readonly selectedTheme = this._selectedTheme.asReadonly();
  readonly systemTheme = this._systemTheme.asReadonly();

  constructor() {
    this.initializeTheme();
    this.setupThemeEffect();
  }

  /**
   * Set the theme preference (locks to light)
   */
  setTheme(_theme: Theme): void {
    this._selectedTheme.set('light');
    localStorage.setItem(this.THEME_KEY, 'light');
  }

  /**
   * Toggle between light and dark themes (no-op in light mode only)
   */
  toggleTheme(): void {
    this.setTheme('light');
  }

  /**
   * Check if dark mode is currently active
   */
  isDarkMode(): boolean {
    return false;
  }

  /**
   * Initialize theme to light mode
   */
  private initializeTheme(): void {
    this._selectedTheme.set('light');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.THEME_KEY, 'light');
    }
  }

  /**
   * Effect to apply theme changes to the DOM
   */
  private setupThemeEffect(): void {
    effect(() => {
      const theme = this.effectiveTheme();
      this.applyThemeToDOM(theme);
    });
  }

  /**
   * Apply theme to DOM by setting data attribute
   */
  private applyThemeToDOM(theme: 'light' | 'dark'): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);

      // Also set class for Angular Material compatibility
      const body = document.body;
      body.classList.remove('light-theme', 'dark-theme');
      body.classList.add(`${theme}-theme`);
    }
  }
}
