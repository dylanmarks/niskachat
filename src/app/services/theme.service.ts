import { computed, effect, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'niska-theme';

  // Reactive signals for theme management
  private readonly _selectedTheme = signal<Theme>('system');
  private readonly _systemTheme = signal<'light' | 'dark'>('light');

  // Computed signal for the effective theme
  readonly effectiveTheme = computed(() => {
    const selected = this._selectedTheme();
    return selected === 'system' ? this._systemTheme() : selected;
  });

  // Public getters
  readonly selectedTheme = this._selectedTheme.asReadonly();
  readonly systemTheme = this._systemTheme.asReadonly();

  constructor() {
    this.initializeTheme();
    this.setupSystemThemeDetection();
    this.setupThemeEffect();
  }

  /**
   * Set the theme preference
   */
  setTheme(theme: Theme): void {
    this._selectedTheme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    const current = this.effectiveTheme();
    this.setTheme(current === 'light' ? 'dark' : 'light');
  }

  /**
   * Check if dark mode is currently active
   */
  isDarkMode(): boolean {
    return this.effectiveTheme() === 'dark';
  }

  /**
   * Initialize theme from localStorage or system preference
   */
  private initializeTheme(): void {
    const saved = localStorage.getItem(this.THEME_KEY) as Theme;

    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      this._selectedTheme.set(saved);
    } else {
      // Default to system preference
      this._selectedTheme.set('system');
    }
  }

  /**
   * Set up system theme detection using media query
   */
  private setupSystemThemeDetection(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      // Set initial system theme
      this._systemTheme.set(mediaQuery.matches ? 'dark' : 'light');

      // Listen for changes
      const handleChange = (e: MediaQueryListEvent) => {
        this._systemTheme.set(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
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
