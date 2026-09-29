import { CommonModule } from '@angular/common';
import {
  Component,
  InjectionToken,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  FhirClientService,
  FhirContext,
} from '../../services/fhir-client.service';
import { logger } from '../../utils/logger';

export const BROWSER_WINDOW = new InjectionToken<Window>('BROWSER_WINDOW', {
  providedIn: 'root',
  factory: () => window,
});

@Component({
  selector: 'app-smart-launch',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './smart-launch.component.html',
  styleUrl: './smart-launch.component.scss',
})
export class SmartLaunchComponent implements OnInit, OnDestroy {
  private fhirClient = inject(FhirClientService);
  private router = inject(Router);
  private browserWindow = inject<Window>(BROWSER_WINDOW);

  private destroy$ = new Subject<void>();

  isLoading = false;
  statusMessage = '';
  errorMessage = '';
  context: FhirContext | null = null;

  ngOnInit(): void {
    // Subscribe to FHIR context changes
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        this.isLoading = false;
      });

    // Check for automatic launch parameters
    this.checkForAutoLaunch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if this is an automatic launch from EHR or callback
   */
  private checkForAutoLaunch(): void {
    const urlParams = new URLSearchParams(this.browserWindow.location.search);
    const isCallback =
      this.browserWindow.location.pathname.includes('callback');
    const hasLaunch = urlParams.has('launch');
    const hasCode = urlParams.has('code');

    if (isCallback || hasCode) {
      // This is a callback from authorization server
      void this.handleCallback();
    } else if (hasLaunch) {
      // This is an EHR launch
      void this.handleEhrLaunch();
    }
  }

  /**
   * Handle callback from authorization server
   */
  async handleCallback(): Promise<void> {
    this.isLoading = true;
    this.statusMessage = 'Processing authorization callback...';
    this.errorMessage = '';

    try {
      await this.fhirClient.handleOAuth2Ready();
      this.statusMessage = 'Authentication successful!';
    } catch (error) {
      this.errorMessage = `Authentication failed: ${String(error)}`;
      logger.error('OAuth2 callback error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Handle EHR launch
   */
  async handleEhrLaunch(): Promise<void> {
    this.isLoading = true;
    this.statusMessage = 'Detecting EHR launch context...';
    this.errorMessage = '';

    try {
      const urlParams = new URLSearchParams(this.browserWindow.location.search);
      const iss = urlParams.get('iss');

      if (!iss) {
        throw new Error('No FHIR server URL (iss) provided in launch context');
      }

      this.statusMessage = 'Initializing SMART launch...';
      await this.fhirClient.initializeSmartLaunch(iss);
    } catch (error) {
      this.errorMessage = `EHR launch failed: ${String(error)}`;
      logger.error('EHR launch error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Handle standalone launch
   */
  async handleStandaloneLaunch(): Promise<void> {
    this.isLoading = true;
    this.statusMessage = 'Launching standalone connection...';
    this.errorMessage = '';

    try {
      await this.fhirClient.initializeSmartLaunch();
    } catch (error) {
      this.errorMessage = `Standalone launch failed: ${String(error)}`;
      logger.error('Standalone launch error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Navigate to test mode
   */
  navigateToTestMode(): void {
    void this.router.navigate(['/test-mode']);
  }

  /**
   * Retry authentication
   */
  retry(): void {
    this.errorMessage = '';
    this.context = null;
    this.fhirClient.clearSession();
  }
}
