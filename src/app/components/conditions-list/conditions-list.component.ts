import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  Condition,
  FhirClientService,
  FhirContext,
} from '../../services/fhir-client.service';

@Component({
  selector: 'app-conditions-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="conditions-container">
      <div class="loading-card" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Loading conditions...</p>
      </div>

      <div class="error-card" *ngIf="errorMessage">
        <h3>❌ Unable to Load Conditions</h3>
        <p>{{ errorMessage }}</p>
        <button class="retry-button" (click)="loadConditions()">Retry</button>
      </div>

      <div class="conditions-card" *ngIf="!isLoading && !errorMessage">
        <div class="conditions-header">
          <h2>📋 Active Conditions</h2>
          <div class="conditions-count" *ngIf="conditions.length > 0">
            <span class="count">{{ conditions.length }}</span>
            <span class="label">
              {{ conditions.length === 1 ? 'condition' : 'conditions' }}
            </span>
          </div>
        </div>

        <div class="conditions-content">
          <div class="no-conditions" *ngIf="conditions.length === 0">
            <h3>✅ No Active Conditions</h3>
            <p>No active conditions found for this patient.</p>
          </div>

          <div class="conditions-list" *ngIf="conditions.length > 0">
            <div
              class="condition-item"
              *ngFor="let condition of conditions; let i = index"
            >
              <div class="condition-main">
                <div class="condition-name">
                  <h4>{{ getConditionName(condition) }}</h4>
                  <span
                    class="condition-status"
                    [class]="getStatusClass(condition)"
                  >
                    {{ getConditionStatus(condition) }}
                  </span>
                </div>

                <div class="condition-details">
                  <div class="detail-item" *ngIf="getOnsetDate(condition)">
                    <span class="label">Onset:</span>
                    <span class="value">{{ getOnsetDate(condition) }}</span>
                  </div>

                  <div class="detail-item" *ngIf="condition.recordedDate">
                    <span class="label">Recorded:</span>
                    <span class="value">
                      {{ formatDate(condition.recordedDate) }}
                    </span>
                  </div>

                  <div
                    class="detail-item"
                    *ngIf="getVerificationStatus(condition)"
                  >
                    <span class="label">Verification:</span>
                    <span class="value">
                      {{ getVerificationStatus(condition) }}
                    </span>
                  </div>
                </div>

                <div class="condition-codes" *ngIf="hasCodings(condition)">
                  <div class="codes-label">Clinical Codes:</div>
                  <div class="code-items">
                    <span
                      class="code-item"
                      *ngFor="let coding of getCodings(condition)"
                    >
                      {{ coding.system | slice: -3 }}: {{ coding.code }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="condition-metadata" *ngIf="hasMetadata(condition)">
                <details class="metadata-details">
                  <summary>Technical Details</summary>
                  <div class="metadata-content">
                    <div class="metadata-item">
                      <span class="label">Condition ID:</span>
                      <span class="value">{{ condition.id }}</span>
                    </div>
                    <div class="metadata-item" *ngIf="condition.subject">
                      <span class="label">Subject:</span>
                      <span class="value">
                        {{
                          condition.subject.reference ||
                            condition.subject.display
                        }}
                      </span>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="no-patient-card"
        *ngIf="!context?.authenticated && !isLoading && !errorMessage"
      >
        <h3>👤 No Patient Selected</h3>
        <p>
          Please complete SMART on FHIR authentication to view patient
          conditions.
        </p>
        <button class="auth-button" (click)="navigateToAuth()">
          Start Authentication
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .conditions-container {
        margin: 2rem auto;
        padding: 1rem;
        max-width: 800px;
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      }

      .loading-card,
      .error-card,
      .no-patient-card {
        margin-bottom: 1rem;
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

      .no-patient-card {
        border: 1px solid #bee5eb;
        background: #f0f8ff;
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

      .conditions-card {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        overflow: hidden;
      }

      .conditions-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
        padding: 1.5rem;
        color: white;
      }

      .conditions-header h2 {
        margin: 0;
        font-size: 1.5rem;
      }

      .conditions-count {
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.2);
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
      }

      .count {
        margin-right: 0.25rem;
        font-weight: bold;
      }

      .conditions-content {
        padding: 1.5rem;
      }

      .no-conditions {
        padding: 2rem;
        color: #6c757d;
        text-align: center;
      }

      .conditions-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .condition-item {
        border: 1px solid #e9ecef;
        border-radius: 8px;
        background: #f8f9fa;
        overflow: hidden;
      }

      .condition-main {
        padding: 1.5rem;
      }

      .condition-name {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .condition-name h4 {
        flex: 1;
        margin: 0;
        color: #212529;
        font-size: 1.1rem;
      }

      .condition-status {
        border-radius: 12px;
        padding: 0.25rem 0.75rem;
        font-weight: 500;
        font-size: 0.8rem;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .status-active {
        background: #d4edda;
        color: #155724;
      }

      .status-inactive {
        background: #f8d7da;
        color: #721c24;
      }

      .status-resolved {
        background: #cce5ff;
        color: #004085;
      }

      .status-unknown {
        background: #e2e3e5;
        color: #383d41;
      }

      .condition-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #dee2e6;
        padding: 0.5rem 0;
      }

      .detail-item:last-child {
        border-bottom: none;
      }

      .label {
        min-width: 80px;
        color: #6c757d;
        font-weight: 500;
      }

      .value {
        color: #212529;
        font-weight: 400;
        text-align: right;
      }

      .condition-codes {
        border-top: 1px solid #dee2e6;
        padding-top: 1rem;
      }

      .codes-label {
        margin-bottom: 0.5rem;
        color: #6c757d;
        font-weight: 500;
        font-size: 0.9rem;
      }

      .code-items {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .code-item {
        border: 1px solid #dee2e6;
        border-radius: 4px;
        background: white;
        padding: 0.25rem 0.5rem;
        color: #495057;
        font-size: 0.8rem;
        font-family: monospace;
      }

      .condition-metadata {
        border-top: 1px solid #e9ecef;
        background: #ffffff;
        padding: 1rem 1.5rem;
      }

      .metadata-details summary {
        cursor: pointer;
        padding: 0.5rem 0;
        color: #6c757d;
        font-weight: 500;
      }

      .metadata-content {
        margin-top: 1rem;
      }

      .metadata-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        font-size: 0.9rem;
      }

      .retry-button,
      .auth-button {
        transition: background-color 0.2s;
        cursor: pointer;
        margin-top: 1rem;
        border: none;
        border-radius: 4px;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
      }

      .retry-button {
        background: #dc3545;
        color: white;
      }

      .retry-button:hover {
        background: #c82333;
      }

      .auth-button {
        background: #007bff;
        color: white;
      }

      .auth-button:hover {
        background: #0056b3;
      }

      @media (max-width: 768px) {
        .conditions-container {
          margin: 1rem;
          padding: 0.5rem;
        }

        .conditions-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
        }

        .condition-name {
          flex-direction: column;
          align-items: flex-start;
        }

        .condition-details {
          grid-template-columns: 1fr;
        }

        .detail-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }

        .value {
          text-align: left;
        }

        .code-items {
          justify-content: flex-start;
        }
      }
    `,
  ],
})
export class ConditionsListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isLoading = false;
  errorMessage = '';
  conditions: Condition[] = [];
  context: FhirContext | null = null;

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    // Subscribe to FHIR context changes
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (context?.authenticated && context.patient) {
          this.loadConditions();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load conditions data from FHIR server
   */
  async loadConditions(): Promise<void> {
    if (!this.fhirClient.isAuthenticated()) {
      this.errorMessage =
        'Not authenticated. Please complete SMART on FHIR login.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      // Fetch active conditions only
      const conditions = await this.fhirClient
        .getConditions({
          'clinical-status': 'active',
        })
        .toPromise();

      this.conditions = this.sortConditionsByDate(conditions || []);
    } catch (error) {
      this.errorMessage = `Failed to load conditions: ${error}`;
      console.error('Error loading conditions:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Sort conditions by most recent first (by recorded date, then onset date)
   */
  private sortConditionsByDate(conditions: Condition[]): Condition[] {
    return conditions.sort((a, b) => {
      // Use recorded date first, then onset date
      const dateA = this.getConditionSortDate(a);
      const dateB = this.getConditionSortDate(b);

      if (dateA && dateB) {
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      } else if (dateA) {
        return -1; // a has date, b doesn't - a comes first
      } else if (dateB) {
        return 1; // b has date, a doesn't - b comes first
      }
      return 0; // neither has date
    });
  }

  /**
   * Get the best date for sorting (recorded date preferred, then onset)
   */
  private getConditionSortDate(condition: Condition): string | null {
    return (
      condition.recordedDate ||
      condition.onsetDateTime ||
      condition.onsetPeriod?.start ||
      null
    );
  }

  /**
   * Get display name for condition
   */
  getConditionName(condition: Condition): string {
    if (condition.code?.text) {
      return condition.code.text;
    }

    if (condition.code?.coding?.[0]?.display) {
      return condition.code.coding[0].display;
    }

    if (condition.code?.coding?.[0]?.code) {
      return `Code: ${condition.code.coding[0].code}`;
    }

    return 'Unknown Condition';
  }

  /**
   * Get clinical status display
   */
  getConditionStatus(condition: Condition): string {
    return (
      condition.clinicalStatus?.coding?.[0]?.display ||
      condition.clinicalStatus?.coding?.[0]?.code ||
      'Unknown'
    );
  }

  /**
   * Get CSS class for status
   */
  getStatusClass(condition: Condition): string {
    const code = condition.clinicalStatus?.coding?.[0]?.code?.toLowerCase();
    switch (code) {
      case 'active':
        return 'status-active';
      case 'inactive':
        return 'status-inactive';
      case 'resolved':
        return 'status-resolved';
      default:
        return 'status-unknown';
    }
  }

  /**
   * Get verification status display
   */
  getVerificationStatus(condition: Condition): string | null {
    return (
      condition.verificationStatus?.coding?.[0]?.display ||
      condition.verificationStatus?.coding?.[0]?.code ||
      null
    );
  }

  /**
   * Get formatted onset date
   */
  getOnsetDate(condition: Condition): string | null {
    if (condition.onsetDateTime) {
      return this.formatDate(condition.onsetDateTime);
    }

    if (condition.onsetPeriod?.start) {
      const start = this.formatDate(condition.onsetPeriod.start);
      const end = condition.onsetPeriod.end
        ? this.formatDate(condition.onsetPeriod.end)
        : 'ongoing';
      return `${start} - ${end}`;
    }

    if (condition.onsetAge) {
      return `Age ${condition.onsetAge.value} ${condition.onsetAge.unit || 'years'}`;
    }

    return null;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Check if condition has coding information
   */
  hasCodings(condition: Condition): boolean {
    return !!condition.code?.coding?.length;
  }

  /**
   * Get coding information for display
   */
  getCodings(condition: Condition): Array<{ system: string; code: string }> {
    if (!condition.code?.coding) {
      return [];
    }

    return condition.code.coding
      .filter((coding) => coding.system && coding.code)
      .map((coding) => ({
        system: coding.system!,
        code: coding.code!,
      }));
  }

  /**
   * Check if condition has metadata worth showing
   */
  hasMetadata(condition: Condition): boolean {
    return !!(condition.id || condition.subject);
  }

  /**
   * Navigate to authentication
   */
  navigateToAuth(): void {
    // In a real app, this would navigate to the auth component
    window.location.href = '/smart-launch';
  }
}
