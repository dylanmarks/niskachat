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
        <h2>Current Medications</h2>
        <div class="medication-count" *ngIf="medications.length > 0">
          <span class="count">{{ medications.length }}</span>
          <span class="label">
            {{ medications.length === 1 ? 'medication' : 'medications' }}
          </span>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading" class="loading-card">
        <div class="loading-spinner"></div>
        <p>Loading medications...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="errorMessage" class="error-card">
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
        class="no-patient-card"
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
        class="empty-card"
      >
        <div class="info-icon">💊</div>
        <h3>No Medications Found</h3>
        <p>No active medications are available for this patient.</p>
      </div>

      <!-- Medications List -->
      <div *ngIf="medications.length > 0" class="medications-list">
        <div
          *ngFor="let medication of medications; trackBy: trackMedication"
          class="medication-card"
        >
          <div class="medication-header">
            <h3 class="medication-name">{{ getMedicationName(medication) }}</h3>
            <span
              class="medication-status"
              [class]="getStatusClass(medication.status)"
            >
              {{ getStatusDisplay(medication.status) }}
            </span>
          </div>

          <div class="medication-details">
            <div class="detail-row" *ngIf="medication.authoredOn">
              <span class="detail-label">Prescribed:</span>
              <span class="detail-value">
                {{ formatDate(medication.authoredOn) }}
              </span>
            </div>

            <div class="detail-row" *ngIf="medication.requester?.display">
              <span class="detail-label">Prescriber:</span>
              <span class="detail-value">
                {{ medication.requester.display }}
              </span>
            </div>

            <div class="detail-row" *ngIf="getDosageText(medication)">
              <span class="detail-label">Dosage:</span>
              <span class="detail-value">{{ getDosageText(medication) }}</span>
            </div>

            <div class="detail-row" *ngIf="getFrequencyText(medication)">
              <span class="detail-label">Frequency:</span>
              <span class="detail-value">
                {{ getFrequencyText(medication) }}
              </span>
            </div>

            <div class="detail-row" *ngIf="getRouteText(medication)">
              <span class="detail-label">Route:</span>
              <span class="detail-value">{{ getRouteText(medication) }}</span>
            </div>

            <div class="detail-row" *ngIf="getQuantityText(medication)">
              <span class="detail-label">Quantity:</span>
              <span class="detail-value">
                {{ getQuantityText(medication) }}
              </span>
            </div>

            <div class="detail-row" *ngIf="getReasonText(medication)">
              <span class="detail-label">Reason:</span>
              <span class="detail-value">{{ getReasonText(medication) }}</span>
            </div>

            <!-- Medication Codes -->
            <div
              class="codes-section"
              *ngIf="getMedicationCodes(medication).length > 0"
            >
              <button
                class="codes-toggle"
                (click)="toggleCodes(medication.id)"
                [class.expanded]="expandedCodes[medication.id]"
              >
                <span>Medication Codes</span>
                <span class="toggle-icon">
                  {{ expandedCodes[medication.id] ? '▼' : '▶' }}
                </span>
              </button>
              <div class="codes-content" *ngIf="expandedCodes[medication.id]">
                <div
                  *ngFor="let code of getMedicationCodes(medication)"
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
  `,
  styles: [
    `
      .medications-container {
        margin: 0 auto;
        padding: 20px;
        max-width: 1200px;
      }

      .medications-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 2px solid #e0e0e0;
        padding-bottom: 15px;
      }

      .medications-header h2 {
        margin: 0;
        color: #333;
        font-weight: 600;
        font-size: 1.8rem;
      }

      .medication-count {
        display: flex;
        align-items: center;
        gap: 8px;
        border-radius: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 8px 16px;
        color: white;
        font-weight: 500;
      }

      .count {
        font-weight: 700;
        font-size: 1.2rem;
      }

      .loading-card,
      .error-card,
      .no-patient-card,
      .empty-card {
        margin-bottom: 20px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        padding: 40px 20px;
        text-align: center;
      }

      .loading-spinner {
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
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

      .error-card {
        border-left: 4px solid #e74c3c;
      }

      .error-icon,
      .info-icon {
        margin-bottom: 10px;
        font-size: 3rem;
      }

      .retry-button {
        transition: background-color 0.2s;
        cursor: pointer;
        margin-top: 15px;
        border: none;
        border-radius: 6px;
        background: #667eea;
        padding: 10px 20px;
        color: white;
        font-weight: 500;
      }

      .retry-button:hover {
        background: #5a67d8;
      }

      .medications-list {
        display: grid;
        gap: 20px;
      }

      .medication-card {
        transition:
          transform 0.2s,
          box-shadow 0.2s;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        padding: 20px;
      }

      .medication-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
      }

      .medication-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 15px;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
      }

      .medication-name {
        flex: 1;
        margin: 0;
        margin-right: 15px;
        color: #2c3e50;
        font-weight: 600;
        font-size: 1.3rem;
      }

      .medication-status {
        border-radius: 20px;
        padding: 4px 12px;
        font-weight: 500;
        font-size: 0.85rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      .medication-status.active {
        background: #d4edda;
        color: #155724;
      }

      .medication-status.completed {
        background: #cce5ff;
        color: #004085;
      }

      .medication-status.cancelled {
        background: #f8d7da;
        color: #721c24;
      }

      .medication-status.draft {
        background: #fff3cd;
        color: #856404;
      }

      .medication-status.on-hold {
        background: #e2e3e5;
        color: #383d41;
      }

      .medication-status.unknown {
        background: #f8f9fa;
        color: #6c757d;
      }

      .medication-details {
        display: grid;
        gap: 8px;
      }

      .detail-row {
        display: grid;
        grid-template-columns: 120px 1fr;
        align-items: start;
        gap: 10px;
      }

      .detail-label {
        color: #666;
        font-weight: 500;
        font-size: 0.9rem;
      }

      .detail-value {
        color: #2c3e50;
        font-size: 0.95rem;
      }

      .codes-section {
        margin-top: 15px;
        border-top: 1px solid #eee;
        padding-top: 15px;
      }

      .codes-toggle {
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s;
        cursor: pointer;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        background: #f8f9fa;
        padding: 8px 12px;
        width: 100%;
        font-size: 0.9rem;
      }

      .codes-toggle:hover {
        background: #e9ecef;
      }

      .codes-toggle.expanded {
        border-bottom-color: transparent;
        border-bottom-right-radius: 0;
        border-bottom-left-radius: 0;
      }

      .codes-content {
        border: 1px solid #dee2e6;
        border-top: none;
        border-bottom-right-radius: 6px;
        border-bottom-left-radius: 6px;
        background: #f8f9fa;
        padding: 10px;
      }

      .code-item {
        display: grid;
        grid-template-columns: 100px 120px 1fr;
        gap: 10px;
        border-bottom: 1px solid #dee2e6;
        padding: 5px 0;
        font-size: 0.85rem;
      }

      .code-item:last-child {
        border-bottom: none;
      }

      .code-system {
        color: #667eea;
        font-weight: 500;
      }

      .code-value {
        border-radius: 3px;
        background: white;
        padding: 2px 6px;
        color: #2c3e50;
        font-family: monospace;
      }

      .code-display {
        color: #666;
      }

      @media (max-width: 768px) {
        .medications-container {
          padding: 15px;
        }

        .medication-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }

        .medication-name {
          margin-right: 0;
          font-size: 1.2rem;
        }

        .detail-row {
          grid-template-columns: 1fr;
          gap: 5px;
        }

        .detail-label {
          font-weight: 600;
        }

        .code-item {
          grid-template-columns: 1fr;
          gap: 5px;
        }
      }
    `,
  ],
})
export class MedicationsListComponent implements OnInit, OnDestroy {
  medications: MedicationRequest[] = [];
  context: FhirContext | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  expandedCodes: { [key: string]: boolean } = {};
  private destroy$ = new Subject<void>();

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (context.patient) {
          this.loadMedications();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadMedications(): Promise<void> {
    if (!this.context?.patient) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const medications = await this.fhirClient
        .getMedicationRequests({
          status: 'active,completed',
          _sort: '-authored',
        })
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
      return dateB - dateA;
    });
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

  getStatusDisplay(status?: string): string {
    switch (status) {
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
        return status || 'Unknown';
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

    const knownSystems: { [key: string]: string } = {
      'http://www.nlm.nih.gov/research/umls/rxnorm': 'RxNorm',
      'http://hl7.org/fhir/sid/ndc': 'NDC',
      'http://snomed.info/sct': 'SNOMED CT',
      'http://www.nlm.nih.gov/research/umls/mmsl': 'MMSL',
      'http://fdasis.nlm.nih.gov': 'FDA SRS',
    };

    return knownSystems[systemUrl] || systemUrl;
  }

  toggleCodes(medicationId: string): void {
    this.expandedCodes[medicationId] = !this.expandedCodes[medicationId];
  }

  trackMedication(_index: number, medication: MedicationRequest): string {
    return medication.id;
  }
}
