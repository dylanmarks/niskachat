import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
  private destroy$ = new Subject<void>();

  isLoading = false;
  statusMessage = '';
  errorMessage = '';
  context: FhirContext | null = null;

  constructor(
    private fhirClient: FhirClientService,
    private router: Router,
  ) {}

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
    const urlParams = new URLSearchParams(window.location.search);
    const isCallback = window.location.pathname.includes('callback');
    const hasLaunch = urlParams.has('launch');
    const hasCode = urlParams.has('code');

    if (isCallback || hasCode) {
      // This is a callback from authorization server
      this.handleCallback();
    } else if (hasLaunch) {
      // This is an EHR launch
      this.handleEhrLaunch();
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
      this.errorMessage = `Authentication failed: ${error}`;
      console.error('OAuth2 callback error:', error);
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
      const urlParams = new URLSearchParams(window.location.search);
      const iss = urlParams.get('iss');

      if (!iss) {
        throw new Error('No FHIR server URL (iss) provided in launch context');
      }

      this.statusMessage = 'Initializing SMART launch...';
      await this.fhirClient.initializeSmartLaunch(iss);
    } catch (error) {
      this.errorMessage = `EHR launch failed: ${error}`;
      console.error('EHR launch error:', error);
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
      this.errorMessage = `Standalone launch failed: ${error}`;
      console.error('Standalone launch error:', error);
    }
  }

  /**
   * Get formatted patient name
   */
  getPatientName(): string {
    if (!this.context?.patient?.name?.[0]) {
      return 'Unknown Patient';
    }

    const name = this.context.patient.name[0];
    const given = name.given?.join(' ') || '';
    const family = name.family || '';

    return `${given} ${family}`.trim() || 'Unknown Patient';
  }

  /**
   * Navigate to main app
   */
  navigateToApp(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Navigate to test mode
   */
  navigateToTestMode(): void {
    this.router.navigate(['/test-mode']);
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
