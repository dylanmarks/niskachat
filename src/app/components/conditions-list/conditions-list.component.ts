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
      <div class="conditions-header">
        <h2>Medical Conditions</h2>
        <div class="condition-count" *ngIf="conditions.length > 0">
          <span class="count">{{ conditions.length }}</span>
          <span class="label">
            {{ conditions.length === 1 ? 'condition' : 'conditions' }}
          </span>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading conditions...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage" class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Error Loading Conditions</h3>
        <p>{{ errorMessage }}</p>
        <button (click)="loadConditions()" class="retry-button">
          Try Again
        </button>
      </div>

      <!-- No Patient State -->
      <div
        *ngIf="
          !context?.authenticated &&
          !context?.isOfflineMode &&
          !isLoading &&
          !errorMessage
        "
        class="no-patient-state"
      >
        <div class="info-icon">👤</div>
        <h3>No Patient Selected</h3>
        <p>Please authenticate and select a patient to view conditions.</p>
      </div>

      <!-- Empty State -->
      <div
        *ngIf="
          !isLoading &&
          !errorMessage &&
          (context?.authenticated || context?.isOfflineMode) &&
          conditions.length === 0
        "
        class="empty-state"
      >
        <div class="info-icon">📋</div>
        <h3>No Active Conditions</h3>
        <p>No active conditions found for this patient.</p>
      </div>

      <!-- Conditions Table -->
      <div *ngIf="conditions.length > 0" class="conditions-table-container">
        <div class="table-wrapper">
          <table class="conditions-table">
            <thead>
              <tr>
                <th>Condition</th>
                <th>Status</th>
                <th>Onset Date</th>
                <th>Recorded Date</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let condition of conditions; trackBy: trackCondition"
                class="condition-row"
                (click)="selectCondition(condition)"
                [class.selected]="selectedConditionId === condition.id"
              >
                <td class="condition-name">
                  {{ getConditionName(condition) }}
                </td>
                <td class="condition-status">
                  <span
                    class="status-badge"
                    [class]="getStatusClass(condition)"
                  >
                    {{ getConditionStatus(condition) }}
                  </span>
                </td>
                <td class="condition-onset">
                  {{ getOnsetDate(condition) || 'N/A' }}
                </td>
                <td class="condition-recorded">
                  {{ formatDate(condition.recordedDate) || 'N/A' }}
                </td>
                <td class="condition-verification">
                  {{ getVerificationStatus(condition) || 'N/A' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Condition Details Panel -->
        <div *ngIf="selectedCondition" class="condition-details-panel">
          <div class="details-header">
            <h3>Condition Details</h3>
            <button
              class="close-button"
              (click)="clearSelection()"
              title="Close details"
            >
              ×
            </button>
          </div>

          <div class="details-content">
            <div class="detail-section">
              <h4>{{ getConditionName(selectedCondition) }}</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value">
                    {{ getConditionStatus(selectedCondition) }}
                  </span>
                </div>

                <div
                  class="detail-item"
                  *ngIf="getVerificationStatus(selectedCondition)"
                >
                  <span class="detail-label">Verification:</span>
                  <span class="detail-value">
                    {{ getVerificationStatus(selectedCondition) }}
                  </span>
                </div>

                <div
                  class="detail-item"
                  *ngIf="getOnsetDate(selectedCondition)"
                >
                  <span class="detail-label">Onset:</span>
                  <span class="detail-value">
                    {{ getOnsetDate(selectedCondition) }}
                  </span>
                </div>

                <div class="detail-item" *ngIf="selectedCondition.recordedDate">
                  <span class="detail-label">Recorded:</span>
                  <span class="detail-value">
                    {{ formatDate(selectedCondition.recordedDate) }}
                  </span>
                </div>

                <div class="detail-item" *ngIf="selectedCondition.id">
                  <span class="detail-label">Condition ID:</span>
                  <span class="detail-value">
                    {{ selectedCondition.id }}
                  </span>
                </div>

                <div class="detail-item" *ngIf="selectedCondition.subject">
                  <span class="detail-label">Subject:</span>
                  <span class="detail-value">
                    {{
                      selectedCondition.subject.reference ||
                        selectedCondition.subject.display
                    }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Clinical Codes -->
            <div class="detail-section" *ngIf="hasCodings(selectedCondition)">
              <h4>Clinical Codes</h4>
              <div class="codes-list">
                <div
                  *ngFor="let coding of getCodings(selectedCondition)"
                  class="code-item"
                >
                  <span class="code-system">
                    {{ getSystemName(coding.system) }}
                  </span>
                  <span class="code-value">{{ coding.code }}</span>
                  <span class="code-display" *ngIf="coding.display">
                    {{ coding.display }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .conditions-container {
        box-sizing: border-box;
        margin: 16px 0 0 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        padding: 16px;
        width: 100%;
        max-width: 100%;
      }

      .conditions-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 12px;
      }

      .conditions-header h2 {
        margin: 0;
        color: #1f2937;
        font-weight: 600;
        font-size: 1.5rem;
      }

      .condition-count {
        display: flex;
        align-items: center;
        gap: 8px;
        border-radius: 20px;
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        padding: 8px 16px;
        color: white;
        font-weight: 500;
      }

      .count {
        font-weight: 700;
        font-size: 1.2rem;
      }

      /* Loading, Error, and Empty States */
      .loading-state,
      .error-state,
      .no-patient-state,
      .empty-state {
        padding: 40px 20px;
        color: #6b7280;
        text-align: center;
      }

      .loading-spinner {
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
        border: 4px solid #f3f4f6;
        border-top: 4px solid #8b5cf6;
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

      .error-icon,
      .info-icon {
        margin-bottom: 16px;
        font-size: 3rem;
      }

      .error-state h3,
      .no-patient-state h3,
      .empty-state h3 {
        margin: 0 0 8px 0;
        color: #1f2937;
        font-weight: 600;
      }

      .retry-button {
        transition: background-color 0.2s;
        cursor: pointer;
        margin-top: 16px;
        border: none;
        border-radius: 6px;
        background-color: #8b5cf6;
        padding: 8px 16px;
        color: white;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .retry-button:hover {
        background-color: #7c3aed;
      }

      /* Table Styles */
      .conditions-table-container {
        display: flex;
        gap: 24px;
        box-sizing: border-box;
        width: 100%;
      }

      .table-wrapper {
        flex: 1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        min-width: 0;
        height: fit-content;
        overflow: hidden;
      }

      .conditions-table {
        border-collapse: collapse;
        background: white;
        width: 100%;
        table-layout: fixed;
        font-size: 14px;
      }

      .conditions-table th {
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        padding: 12px 8px;
        color: #374151;
        font-weight: 600;
        text-align: left;
      }

      .condition-row {
        transition: all 0.2s ease;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
      }

      .condition-row:hover {
        background-color: #f9fafb;
      }

      .condition-row.selected {
        border-left: 4px solid #8b5cf6;
        background-color: #eff6ff;
      }

      .conditions-table td {
        vertical-align: middle;
        padding: 12px 8px;
        word-wrap: break-word;
        overflow: hidden;
      }

      .condition-name {
        width: 30%;
        color: #1f2937;
        font-weight: 500;
      }

      .condition-status {
        width: 15%;
      }

      .condition-onset,
      .condition-recorded,
      .condition-verification {
        width: 18%;
        color: #6b7280;
      }

      .status-badge {
        display: inline-block;
        border-radius: 12px;
        padding: 4px 8px;
        font-weight: 500;
        font-size: 12px;
        text-transform: uppercase;
      }

      .status-badge.active {
        background: #d1fae5;
        color: #065f46;
      }

      .status-badge.inactive {
        background: #fee2e2;
        color: #991b1b;
      }

      .status-badge.resolved {
        background: #dbeafe;
        color: #1e40af;
      }

      .status-badge.unknown {
        background: #f3f4f6;
        color: #6b7280;
      }

      /* Details Panel */
      .condition-details-panel {
        flex: 0 0 350px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #f9fafb;
        overflow: hidden;
      }

      .details-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e5e7eb;
        background: #f3f4f6;
        padding: 16px 20px;
      }

      .details-header h3 {
        margin: 0;
        color: #1f2937;
        font-weight: 600;
        font-size: 1.1rem;
      }

      .close-button {
        transition: color 0.2s;
        cursor: pointer;
        border: none;
        background: none;
        padding: 4px;
        color: #6b7280;
        font-size: 24px;
        line-height: 1;
      }

      .close-button:hover {
        color: #374151;
      }

      .details-content {
        padding: 20px;
        max-height: 500px;
        overflow-y: auto;
      }

      .detail-section {
        margin-bottom: 24px;
      }

      .detail-section:last-child {
        margin-bottom: 0;
      }

      .detail-section h4 {
        margin: 0 0 12px 0;
        color: #1f2937;
        font-weight: 600;
        font-size: 1.1rem;
        word-wrap: break-word;
      }

      .detail-grid {
        display: grid;
        gap: 12px;
      }

      .detail-item {
        display: grid;
        grid-template-columns: 1fr 2fr;
        align-items: start;
        gap: 8px;
      }

      .detail-label {
        color: #374151;
        font-weight: 500;
        font-size: 13px;
      }

      .detail-value {
        color: #1f2937;
        font-size: 13px;
        word-wrap: break-word;
      }

      .codes-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .code-item {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 8px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: white;
        padding: 8px 12px;
        font-size: 12px;
      }

      .code-system {
        border-radius: 4px;
        background: #f3f4f6;
        padding: 2px 6px;
        color: #6b7280;
        font-weight: 500;
        white-space: nowrap;
      }

      .code-value {
        color: #1f2937;
        font-weight: 500;
        font-family: monospace;
        word-break: break-all;
      }

      .code-display {
        color: #6b7280;
        font-style: italic;
        word-wrap: break-word;
      }

      /* Responsive Design */
      @media (max-width: 1200px) {
        .conditions-table-container {
          flex-direction: column;
        }

        .condition-details-panel {
          flex: none;
        }
      }

      @media (max-width: 768px) {
        .conditions-container {
          margin: 8px 0;
          padding: 16px;
        }

        .conditions-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }

        .conditions-table {
          font-size: 12px;
        }

        .conditions-table th,
        .conditions-table td {
          padding: 8px 4px;
        }

        /* Adjust column widths for mobile */
        .condition-name {
          width: 50%;
        }

        .condition-status {
          width: 25%;
        }

        .condition-onset {
          width: 25%;
        }

        /* Hide less important columns on mobile */
        .condition-recorded,
        .condition-verification {
          display: none;
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
  selectedConditionId: string | null = null;
  selectedCondition: Condition | null = null;

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
  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  }

  /**
   * Check if condition has coding information
   */
  hasCodings(condition: Condition): boolean {
    return !!condition.code?.coding?.length;
  }

  /**
   * Get condition codings for display
   */
  getCodings(
    condition: Condition,
  ): { system: string; code: string; display?: string }[] {
    const codings: { system: string; code: string; display?: string }[] = [];

    if (condition.code?.coding) {
      condition.code.coding.forEach((coding) => {
        if (coding.system && coding.code) {
          const codingEntry: {
            system: string;
            code: string;
            display?: string;
          } = {
            system: coding.system,
            code: coding.code,
          };

          if (coding.display) {
            codingEntry.display = coding.display;
          }

          codings.push(codingEntry);
        }
      });
    }

    return codings;
  }

  /**
   * Get system name for coding system
   */
  getSystemName(system: string): string {
    // Implement your logic to map system to a readable name
    return system;
  }

  /**
   * Select a condition
   */
  selectCondition(condition: Condition): void {
    this.selectedConditionId = condition.id;
    this.selectedCondition = condition;
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedConditionId = null;
    this.selectedCondition = null;
  }

  /**
   * Track condition by ID
   */
  trackCondition(index: number, condition: Condition): string {
    return condition.id || index.toString();
  }
}
