import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
  imports: [CommonModule],
  template: `
    <div class="smart-launch-container">
      <div class="loading-card" *ngIf="isLoading">
        <h2>🔐 Connecting to FHIR Server</h2>
        <div class="spinner"></div>
        <p>{{ statusMessage }}</p>
      </div>

      <div class="error-card" *ngIf="errorMessage">
        <h2>❌ Authentication Failed</h2>
        <p>{{ errorMessage }}</p>
        <button class="retry-button" (click)="retry()">Try Again</button>
      </div>

      <div class="success-card" *ngIf="context?.authenticated">
        <h2>✅ Authentication Successful</h2>
        <p>Connected to FHIR server</p>
        <div class="patient-info" *ngIf="context?.patient">
          <h3>Patient: {{ getPatientName() }}</h3>
          <p>ID: {{ context?.patient?.id }}</p>
        </div>
        <button class="continue-button" (click)="navigateToApp()">
          Continue to App
        </button>
      </div>

      <div
        class="launch-options"
        *ngIf="!isLoading && !context?.authenticated && !errorMessage"
      >
        <h2>🚀 SMART on FHIR Launch</h2>

        <div class="launch-method">
          <h3>EHR Launch</h3>
          <p>
            If you were redirected here from an EHR, we'll automatically detect
            the launch context.
          </p>
          <button class="launch-button" (click)="handleEhrLaunch()">
            Check for EHR Launch
          </button>
        </div>

        <div class="launch-method">
          <h3>Standalone Launch</h3>
          <p>Connect directly to a FHIR server (SMART Health IT Sandbox)</p>
          <button class="launch-button" (click)="handleStandaloneLaunch()">
            Launch Standalone
          </button>
        </div>

        <div class="test-mode">
          <h3>Test Mode</h3>
          <p>Upload a FHIR Bundle file for testing</p>
          <button class="test-button" (click)="navigateToTestMode()">
            Test Mode
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .smart-launch-container {
        margin: 2rem auto;
        padding: 2rem;
        max-width: 600px;
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      }

      .loading-card,
      .error-card,
      .success-card {
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        padding: 2rem;
        text-align: center;
      }

      .loading-card {
        background: #f8f9fa;
      }

      .error-card {
        border: 1px solid #fcc;
        background: #fee;
      }

      .success-card {
        border: 1px solid #cfc;
        background: #efe;
      }

      .spinner {
        animation: spin 1s linear infinite;
        margin: 1rem auto;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        width: 40px;
        height: 40px;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .launch-options {
        text-align: center;
      }

      .launch-method,
      .test-mode {
        margin: 2rem 0;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #fafafa;
        padding: 1.5rem;
      }

      .launch-button,
      .continue-button,
      .retry-button,
      .test-button {
        transition: background-color 0.2s;
        cursor: pointer;
        margin: 0.5rem;
        border: none;
        border-radius: 4px;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
      }

      .launch-button {
        background: #007bff;
        color: white;
      }

      .launch-button:hover {
        background: #0056b3;
      }

      .continue-button {
        background: #28a745;
        color: white;
      }

      .continue-button:hover {
        background: #1e7e34;
      }

      .retry-button {
        background: #dc3545;
        color: white;
      }

      .retry-button:hover {
        background: #c82333;
      }

      .test-button {
        background: #6c757d;
        color: white;
      }

      .test-button:hover {
        background: #545b62;
      }

      .patient-info {
        margin: 1rem 0;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        padding: 1rem;
      }

      h2 {
        margin: 0 0 1rem 0;
        color: #333;
      }

      h3 {
        margin: 0 0 0.5rem 0;
        color: #555;
      }

      p {
        margin: 0.5rem 0;
        color: #666;
      }
    `,
  ],
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
