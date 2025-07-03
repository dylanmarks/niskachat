import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  FhirClientService,
  FhirContext,
  MedicationRequest,
} from '../../services/fhir-client.service';

@Component({
  selector: 'app-medications-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="medications-container">
      <div class="medications-header">
        <h2>Medications</h2>
        <div class="header-controls">
          <div class="medication-count" *ngIf="activeMedications.length > 0">
            <span class="count">{{ activeMedications.length }}</span>
            <span class="label">
              {{
                activeMedications.length === 1
                  ? 'active medication'
                  : 'active medications'
              }}
            </span>
          </div>
          <button
            *ngIf="inactiveMedications.length > 0"
            class="toggle-inactive-btn"
            (click)="toggleInactive()"
            [class.active]="showInactive"
          >
            {{ showInactive ? 'Hide' : 'Show' }} Inactive Medications ({{
              inactiveMedications.length
            }})
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading medications...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage" class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Error Loading Medications</h3>
        <p>{{ errorMessage }}</p>
        <button (click)="loadMedications()" class="retry-button">
          Try Again
        </button>
      </div>

      <!-- No Patient State -->
      <div
        *ngIf="!isLoading && !errorMessage && !context?.patient"
        class="no-patient-state"
      >
        <div class="info-icon">👤</div>
        <h3>No Patient Selected</h3>
        <p>Please authenticate and select a patient to view medications.</p>
      </div>

      <!-- Empty State -->
      <div
        *ngIf="
          !isLoading &&
          !errorMessage &&
          context?.patient &&
          medications.length === 0
        "
        class="empty-state"
      >
        <div class="info-icon">💊</div>
        <h3>No Medications Found</h3>
        <p>No medications are available for this patient.</p>
      </div>

      <!-- Active Medications Table -->
      <div *ngIf="activeMedications.length > 0" class="medications-section">
        <h3 class="section-title">Active Medications</h3>
        <div class="medications-table-container">
          <div class="table-wrapper">
            <table class="medications-table">
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Status</th>
                  <th>Prescribed Date</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="
                    let medication of activeMedications;
                    trackBy: trackMedication
                  "
                  class="medication-row"
                  (click)="selectMedication(medication)"
                  [class.selected]="selectedMedicationId === medication.id"
                >
                  <td class="medication-name">
                    {{ getMedicationName(medication) }}
                  </td>
                  <td class="medication-status">
                    <span
                      class="status-badge"
                      [class]="getStatusClass(medication.status)"
                    >
                      {{ getMedicationStatus(medication) }}
                    </span>
                  </td>
                  <td class="medication-date">
                    {{ formatDate(medication.authoredOn) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Medication Details Panel -->
          <div *ngIf="selectedMedication" class="medication-details-panel">
            <div class="details-header">
              <h3>Medication Details</h3>
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
                <h4>{{ getMedicationName(selectedMedication) }}</h4>
                <div class="detail-grid">
                  <div
                    class="detail-item"
                    *ngIf="selectedMedication.authoredOn"
                  >
                    <span class="detail-label">Prescribed:</span>
                    <span class="detail-value">
                      {{ formatDate(selectedMedication.authoredOn) }}
                    </span>
                  </div>

                  <div
                    class="detail-item"
                    *ngIf="selectedMedication.requester?.display"
                  >
                    <span class="detail-label">Prescriber:</span>
                    <span class="detail-value">
                      {{ selectedMedication.requester?.display }}
                    </span>
                  </div>

                  <div
                    class="detail-item"
                    *ngIf="getDosageText(selectedMedication)"
                  >
                    <span class="detail-label">Dosage:</span>
                    <span class="detail-value">
                      {{ getDosageText(selectedMedication) }}
                    </span>
                  </div>

                  <div
                    class="detail-item"
                    *ngIf="getFrequencyText(selectedMedication)"
                  >
                    <span class="detail-label">Frequency:</span>
                    <span class="detail-value">
                      {{ getFrequencyText(selectedMedication) }}
                    </span>
                  </div>

                  <div
                    class="detail-item"
                    *ngIf="getRouteText(selectedMedication)"
                  >
                    <span class="detail-label">Route:</span>
                    <span class="detail-value">
                      {{ getRouteText(selectedMedication) }}
                    </span>
                  </div>

                  <div
                    class="detail-item"
                    *ngIf="getQuantityText(selectedMedication)"
                  >
                    <span class="detail-label">Quantity:</span>
                    <span class="detail-value">
                      {{ getQuantityText(selectedMedication) }}
                    </span>
                  </div>

                  <div
                    class="detail-item"
                    *ngIf="getReasonText(selectedMedication)"
                  >
                    <span class="detail-label">Reason:</span>
                    <span class="detail-value">
                      {{ getReasonText(selectedMedication) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Medication Codes -->
              <div
                class="detail-section"
                *ngIf="getMedicationCodes(selectedMedication).length > 0"
              >
                <h4>Medication Codes</h4>
                <div class="codes-list">
                  <div
                    *ngFor="let code of getMedicationCodes(selectedMedication)"
                    class="code-item"
                  >
                    <span class="code-system">
                      {{ getCodeSystem(code.system) }}
                    </span>
                    <span class="code-value">{{ code.code }}</span>
                    <span class="code-display" *ngIf="code.display">
                      {{ code.display }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Inactive Medications Table -->
      <div
        *ngIf="showInactive && inactiveMedications.length > 0"
        class="medications-section inactive-section"
      >
        <h3 class="section-title">Inactive Medications</h3>
        <div class="medications-table-container">
          <div class="table-wrapper">
            <table class="medications-table">
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Status</th>
                  <th>Prescribed Date</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="
                    let medication of inactiveMedications;
                    trackBy: trackMedication
                  "
                  class="medication-row"
                  (click)="selectMedication(medication)"
                  [class.selected]="selectedMedicationId === medication.id"
                >
                  <td class="medication-name">
                    {{ getMedicationName(medication) }}
                  </td>
                  <td class="medication-status">
                    <span
                      class="status-badge"
                      [class]="getStatusClass(medication.status)"
                    >
                      {{ getMedicationStatus(medication) }}
                    </span>
                  </td>
                  <td class="medication-date">
                    {{ formatDate(medication.authoredOn) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- No Active Medications Message -->
      <div
        *ngIf="
          !isLoading &&
          !errorMessage &&
          context?.patient &&
          medications.length > 0 &&
          activeMedications.length === 0
        "
        class="no-active-state"
      >
        <div class="info-icon">💊</div>
        <h3>No Active Medications</h3>
        <p>All medications for this patient are inactive.</p>
        <button
          *ngIf="inactiveMedications.length > 0 && !showInactive"
          class="show-inactive-btn"
          (click)="toggleInactive()"
        >
          Show {{ inactiveMedications.length }} Inactive Medications
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .medications-container {
        box-sizing: border-box;
        margin: 16px 0 0 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        padding: 16px;
        width: 100%;
        max-width: 100%;
      }

      .medications-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-sizing: border-box;
        margin-bottom: 16px;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 12px;
        width: 100%;
      }

      .medications-header h2 {
        margin: 0;
        color: #1f2937;
        font-weight: 600;
        font-size: 1.5rem;
      }

      .header-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;
      }

      .medication-count {
        display: flex;
        align-items: center;
        gap: 8px;
        border-radius: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        padding: 8px 16px;
        color: white;
        font-weight: 500;
      }

      .count {
        font-weight: 700;
        font-size: 1.2rem;
      }

      .toggle-inactive-btn,
      .show-inactive-btn {
        transition: all 0.2s ease;
        cursor: pointer;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-weight: 500;
        font-size: 0.875rem;
        white-space: nowrap;
      }

      .toggle-inactive-btn {
        background-color: #6b7280;
        color: white;
      }

      .toggle-inactive-btn:hover {
        background-color: #4b5563;
      }

      .toggle-inactive-btn.active {
        background-color: #3b82f6;
      }

      .toggle-inactive-btn.active:hover {
        background-color: #2563eb;
      }

      .show-inactive-btn {
        margin-top: 16px;
        background-color: #10b981;
        color: white;
      }

      .show-inactive-btn:hover {
        background-color: #059669;
      }

      /* Loading, Error, and Empty States */
      .loading-state,
      .error-state,
      .no-patient-state,
      .empty-state,
      .no-active-state {
        padding: 40px 20px;
        color: #6b7280;
        text-align: center;
      }

      .loading-spinner {
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
        border: 4px solid #f3f4f6;
        border-top: 4px solid #10b981;
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
      .empty-state h3,
      .no-active-state h3 {
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
        background-color: #10b981;
        padding: 8px 16px;
        color: white;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .retry-button:hover {
        background-color: #059669;
      }

      /* Medication Sections */
      .medications-section {
        box-sizing: border-box;
        margin-bottom: 32px;
        width: 100%;
      }

      .medications-section:last-child {
        margin-bottom: 0;
      }

      .section-title {
        margin: 0 0 16px 0;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 8px;
        color: #1f2937;
        font-weight: 600;
        font-size: 1.25rem;
      }

      .inactive-section .section-title {
        border-bottom-color: #d1d5db;
        color: #6b7280;
      }

      .inactive-section .medications-table {
        opacity: 0.8;
      }

      /* Table Styles */
      .medications-table-container {
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

      .medications-table {
        border-collapse: collapse;
        background: white;
        width: 100%;
        table-layout: fixed; /* Prevent table from growing too wide */
        font-size: 14px;
      }

      .medications-table th {
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        padding: 12px 8px;
        color: #374151;
        font-weight: 600;
        text-align: left;
      }

      .medication-row {
        transition: all 0.2s ease;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
      }

      .medication-row:hover {
        background-color: #f9fafb;
      }

      .medication-row.selected {
        border-left: 4px solid #3b82f6;
        background-color: #eff6ff;
      }

      .medications-table td {
        vertical-align: middle;
        padding: 12px 8px;
        word-wrap: break-word;
        overflow: hidden;
      }

      .medication-name {
        width: 30%;
        color: #1f2937;
        font-weight: 500;
      }

      .medication-status {
        width: 15%;
      }

      .medication-date {
        width: 20%;
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

      .status-badge.completed {
        background: #dbeafe;
        color: #1e40af;
      }

      .status-badge.cancelled,
      .status-badge.stopped {
        background: #fee2e2;
        color: #991b1b;
      }

      .status-badge.draft {
        background: #fef3c7;
        color: #92400e;
      }

      .status-badge.on-hold {
        background: #e0e7ff;
        color: #3730a3;
      }

      .status-badge.unknown {
        background: #f3f4f6;
        color: #6b7280;
      }

      /* Details Panel */
      .medication-details-panel {
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
        .medications-table-container {
          flex-direction: column;
        }

        .medication-details-panel {
          flex: none;
        }
      }

      @media (max-width: 768px) {
        .medications-container {
          margin: 8px 0;
          padding: 16px;
        }

        .medications-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }

        .header-controls {
          justify-content: space-between;
          width: 100%;
        }

        .medications-table {
          font-size: 12px;
        }

        .medications-table th,
        .medications-table td {
          padding: 8px 4px;
        }

        /* Adjust column widths for mobile */
        .medication-name {
          width: 60%;
        }

        .medication-status {
          width: 20%;
        }

        .medication-date {
          width: 20%;
        }

        /* Hide status on very small screens */
        @media (max-width: 480px) {
          .medication-status {
            display: none;
          }

          .medication-name {
            width: 70%;
          }

          .medication-date {
            width: 30%;
          }
        }
      }
    `,
  ],
  animations: [
    // You can add animation here if needed
  ],
})
export class MedicationsListComponent implements OnInit, OnDestroy {
  medications: MedicationRequest[] = [];
  context: FhirContext | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  selectedMedication: MedicationRequest | null = null;
  selectedMedicationId: string | null = null;
  showInactive = false;

  private destroy$ = new Subject<void>();

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (
          context.patient &&
          (context.authenticated || context.isOfflineMode)
        ) {
          this.loadMedications();
        } else {
          this.medications = [];
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadMedications(): Promise<void> {
    if (!this.context?.patient) {
      this.errorMessage = 'No patient context available';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const medications = await this.fhirClient
        .getMedicationRequests()
        .pipe(takeUntil(this.destroy$))
        .toPromise();

      this.medications = this.sortMedicationsByDate(medications || []);
    } catch (error) {
      console.error('Error loading medications:', error);
      this.errorMessage = 'Failed to load medications. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  private sortMedicationsByDate(
    medications: MedicationRequest[],
  ): MedicationRequest[] {
    return medications.sort((a, b) => {
      const dateA = a.authoredOn ? new Date(a.authoredOn).getTime() : 0;
      const dateB = b.authoredOn ? new Date(b.authoredOn).getTime() : 0;
      return dateB - dateA; // Most recent first
    });
  }

  selectMedication(medication: MedicationRequest): void {
    if (this.selectedMedicationId === medication.id) {
      // Toggle off if clicking the same medication
      this.clearSelection();
    } else {
      this.selectedMedication = medication;
      this.selectedMedicationId = medication.id;
    }
  }

  clearSelection(): void {
    this.selectedMedication = null;
    this.selectedMedicationId = null;
  }

  getMedicationName(medication: MedicationRequest): string {
    // Try medicationCodeableConcept first
    if (medication.medicationCodeableConcept) {
      const concept = medication.medicationCodeableConcept;
      if (concept.text) {
        return concept.text;
      }
      if (concept.coding && concept.coding.length > 0) {
        const firstCoding = concept.coding[0];
        if (firstCoding) {
          return (
            firstCoding.display || firstCoding.code || 'Unknown Medication'
          );
        }
      }
    }

    // Try medicationReference
    if (medication.medicationReference?.display) {
      return medication.medicationReference.display;
    }

    return 'Unknown Medication';
  }

  getMedicationStatus(medication: MedicationRequest): string {
    switch (medication.status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'draft':
        return 'Draft';
      case 'on-hold':
        return 'On Hold';
      case 'stopped':
        return 'Stopped';
      case 'unknown':
        return 'Unknown';
      default:
        return medication.status || 'Unknown';
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'active':
        return 'active';
      case 'completed':
        return 'completed';
      case 'cancelled':
      case 'stopped':
        return 'cancelled';
      case 'draft':
        return 'draft';
      case 'on-hold':
        return 'on-hold';
      default:
        return 'unknown';
    }
  }

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

  getDosageText(medication: MedicationRequest): string {
    if (
      !medication.dosageInstruction ||
      medication.dosageInstruction.length === 0
    ) {
      return '';
    }

    const dosage = medication.dosageInstruction[0];
    if (!dosage) {
      return '';
    }

    if (dosage.text) {
      return dosage.text;
    }

    if (dosage.doseAndRate && dosage.doseAndRate.length > 0) {
      const doseAndRate = dosage.doseAndRate[0];
      if (doseAndRate?.doseQuantity) {
        const qty = doseAndRate.doseQuantity;
        return `${qty.value} ${qty.unit || qty.code || ''}`;
      }
      if (doseAndRate?.doseRange) {
        const range = doseAndRate.doseRange;
        const low = range.low
          ? `${range.low.value} ${range.low.unit || ''}`
          : '';
        const high = range.high
          ? `${range.high.value} ${range.high.unit || ''}`
          : '';
        return `${low} - ${high}`;
      }
    }

    return '';
  }

  getFrequencyText(medication: MedicationRequest): string {
    if (
      !medication.dosageInstruction ||
      medication.dosageInstruction.length === 0
    ) {
      return '';
    }

    const dosage = medication.dosageInstruction[0];
    if (!dosage?.timing?.repeat) {
      return '';
    }

    const repeat = dosage.timing.repeat;
    if (repeat.frequency && repeat.period && repeat.periodUnit) {
      return `${repeat.frequency} time(s) per ${repeat.period} ${repeat.periodUnit}`;
    }

    return '';
  }

  getRouteText(medication: MedicationRequest): string {
    if (
      !medication.dosageInstruction ||
      medication.dosageInstruction.length === 0
    ) {
      return '';
    }

    const dosage = medication.dosageInstruction[0];
    if (!dosage?.route) {
      return '';
    }

    if (dosage.route.text) {
      return dosage.route.text;
    }
    if (dosage.route.coding && dosage.route.coding.length > 0) {
      const coding = dosage.route.coding[0];
      if (coding) {
        return coding.display || coding.code || '';
      }
    }

    return '';
  }

  getQuantityText(medication: MedicationRequest): string {
    if (medication.dispenseRequest?.quantity) {
      const qty = medication.dispenseRequest.quantity;
      return `${qty.value} ${qty.unit || qty.code || ''}`;
    }
    return '';
  }

  getReasonText(medication: MedicationRequest): string {
    if (medication.reasonCode && medication.reasonCode.length > 0) {
      const reason = medication.reasonCode[0];
      if (reason) {
        if (reason.text) {
          return reason.text;
        }
        if (reason.coding && reason.coding.length > 0) {
          const coding = reason.coding[0];
          if (coding) {
            return coding.display || coding.code || '';
          }
        }
      }
    }

    if (medication.reasonReference && medication.reasonReference.length > 0) {
      const reference = medication.reasonReference[0];
      if (reference) {
        return reference.display || reference.reference || '';
      }
    }

    return '';
  }

  getMedicationCodes(
    medication: MedicationRequest,
  ): { system: string; code: string; display?: string }[] {
    const codes: { system: string; code: string; display?: string }[] = [];

    if (medication.medicationCodeableConcept?.coding) {
      for (const coding of medication.medicationCodeableConcept.coding) {
        if (coding.system && coding.code) {
          const codeItem: { system: string; code: string; display?: string } = {
            system: coding.system,
            code: coding.code,
          };
          if (coding.display) {
            codeItem.display = coding.display;
          }
          codes.push(codeItem);
        }
      }
    }

    return codes;
  }

  getCodeSystem(systemUrl?: string): string {
    if (!systemUrl) return 'Unknown';

    const knownSystems: Record<string, string> = {
      'http://www.nlm.nih.gov/research/umls/rxnorm': 'RxNorm',
      'http://hl7.org/fhir/sid/ndc': 'NDC',
      'http://snomed.info/sct': 'SNOMED CT',
      'http://www.nlm.nih.gov/research/umls/mmsl': 'MMSL',
      'http://fdasis.nlm.nih.gov': 'FDA SRS',
    };

    return knownSystems[systemUrl] || systemUrl;
  }

  trackMedication(_index: number, medication: MedicationRequest): string {
    return medication.id;
  }

  toggleInactive(): void {
    this.showInactive = !this.showInactive;
  }

  get activeMedications(): MedicationRequest[] {
    return this.medications.filter(
      (m) => this.getStatusClass(m.status) === 'active',
    );
  }

  get inactiveMedications(): MedicationRequest[] {
    return this.medications.filter(
      (m) => this.getStatusClass(m.status) !== 'active',
    );
  }
}
