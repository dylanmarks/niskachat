import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  FhirClientService,
  FhirContext,
  Patient,
} from '../../services/fhir-client.service';

@Component({
  selector: 'app-patient-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="patient-summary-container">
      <div class="loading-card" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Loading patient information...</p>
      </div>

      <div class="error-card" *ngIf="errorMessage">
        <h3>❌ Unable to Load Patient</h3>
        <p>{{ errorMessage }}</p>
        <button class="retry-button" (click)="loadPatient()">Retry</button>
      </div>

      <div class="patient-card" *ngIf="patient && !isLoading && !errorMessage">
        <div class="patient-header">
          <h2>👤 Patient Summary</h2>
          <div class="patient-id" *ngIf="patient.id">
            <span class="label">Patient ID:</span>
            <span class="value">{{ patient.id }}</span>
          </div>
        </div>

        <div class="patient-info">
          <div class="info-section">
            <h3>Demographics</h3>

            <div class="info-item">
              <span class="label">Name:</span>
              <span class="value">{{ getPatientName() }}</span>
            </div>

            <div class="info-item" *ngIf="patient.birthDate">
              <span class="label">Date of Birth:</span>
              <span class="value">{{ formatDate(patient.birthDate) }}</span>
            </div>

            <div class="info-item" *ngIf="getAge()">
              <span class="label">Age:</span>
              <span class="value">{{ getAge() }} years old</span>
            </div>

            <div class="info-item" *ngIf="patient.gender">
              <span class="label">Gender:</span>
              <span class="value">{{ formatGender(patient.gender) }}</span>
            </div>
          </div>

          <div class="info-section" *ngIf="getMedicalRecordNumber()">
            <h3>Medical Record</h3>
            <div class="info-item">
              <span class="label">MRN:</span>
              <span class="value">{{ getMedicalRecordNumber() }}</span>
            </div>
          </div>

          <div class="info-section" *ngIf="hasContactInfo()">
            <h3>Contact Information</h3>

            <div class="contact-list">
              <div
                class="contact-item"
                *ngFor="let contact of getContactInfo()"
              >
                <span class="contact-type">{{ contact.type }}:</span>
                <span class="contact-value">{{ contact.value }}</span>
              </div>
            </div>
          </div>

          <div class="info-section" *ngIf="hasAddresses()">
            <h3>Address</h3>
            <div class="address-list">
              <div class="address-item" *ngFor="let address of getAddresses()">
                <div class="address-type">{{ address.type }}</div>
                <div class="address-text">{{ address.text }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="patient-metadata" *ngIf="hasMetadata()">
          <details class="metadata-details">
            <summary>Technical Details</summary>
            <div class="metadata-content">
              <div class="metadata-item" *ngIf="context?.clientId">
                <span class="label">FHIR Client ID:</span>
                <span class="value">{{ context?.clientId }}</span>
              </div>
              <div class="metadata-item" *ngIf="context?.serverUrl">
                <span class="label">FHIR Server:</span>
                <span class="value">{{ context?.serverUrl }}</span>
              </div>
              <div class="metadata-item" *ngIf="context?.scope">
                <span class="label">OAuth Scope:</span>
                <span class="value">{{ context?.scope }}</span>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div
        class="no-patient-card"
        *ngIf="!patient && !isLoading && !errorMessage"
      >
        <h3>👤 No Patient Selected</h3>
        <p>
          Please complete SMART on FHIR authentication to view patient
          information.
        </p>
        <button class="auth-button" (click)="navigateToAuth()">
          Start Authentication
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .patient-summary-container {
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

      .patient-card {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        overflow: hidden;
      }

      .patient-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1.5rem;
        color: white;
      }

      .patient-header h2 {
        margin: 0;
        font-size: 1.5rem;
      }

      .patient-id {
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.2);
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
      }

      .patient-info {
        padding: 1.5rem;
      }

      .info-section {
        margin-bottom: 2rem;
        border-bottom: 1px solid #e9ecef;
        padding-bottom: 1.5rem;
      }

      .info-section:last-child {
        margin-bottom: 0;
        border-bottom: none;
      }

      .info-section h3 {
        margin: 0 0 1rem 0;
        color: #495057;
        font-weight: 600;
        font-size: 1.1rem;
      }

      .info-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f8f9fa;
        padding: 0.75rem 0;
      }

      .info-item:last-child {
        border-bottom: none;
      }

      .label {
        min-width: 120px;
        color: #6c757d;
        font-weight: 500;
      }

      .value {
        flex: 1;
        color: #212529;
        font-weight: 400;
        text-align: right;
      }

      .contact-list,
      .address-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .contact-item {
        display: flex;
        justify-content: space-between;
        border-radius: 4px;
        background: #f8f9fa;
        padding: 0.5rem;
      }

      .contact-type {
        color: #6c757d;
        font-weight: 500;
        text-transform: capitalize;
      }

      .contact-value {
        color: #212529;
      }

      .address-item {
        margin-bottom: 0.5rem;
        border-radius: 4px;
        background: #f8f9fa;
        padding: 0.75rem;
      }

      .address-type {
        color: #6c757d;
        font-weight: 500;
        font-size: 0.9rem;
        text-transform: capitalize;
      }

      .address-text {
        margin-top: 0.25rem;
        color: #212529;
      }

      .patient-metadata {
        border-top: 1px solid #e9ecef;
        background: #f8f9fa;
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
        .patient-summary-container {
          margin: 1rem;
          padding: 0.5rem;
        }

        .patient-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
        }

        .info-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }

        .value {
          text-align: left;
        }

        .contact-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }
      }
    `,
  ],
})
export class PatientSummaryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isLoading = false;
  errorMessage = '';
  patient: Patient | null = null;
  context: FhirContext | null = null;

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    // Subscribe to FHIR context changes
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (context?.authenticated && context.patient) {
          this.patient = context.patient;
          this.errorMessage = '';
        } else if (context?.authenticated && !context.patient) {
          this.loadPatient();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load patient data from FHIR server
   */
  async loadPatient(): Promise<void> {
    if (!this.fhirClient.isAuthenticated()) {
      this.errorMessage =
        'Not authenticated. Please complete SMART on FHIR login.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const patient = await this.fhirClient.getPatient().toPromise();
      this.patient = patient ?? null;
    } catch (error) {
      this.errorMessage = `Failed to load patient: ${error}`;
      console.error('Error loading patient:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get formatted patient name
   */
  getPatientName(): string {
    if (!this.patient?.name?.[0]) {
      return 'Unknown Patient';
    }

    const name = this.patient.name[0];
    const given = name.given?.join(' ') ?? '';
    const family = name.family ?? '';

    return `${given} ${family}`.trim() || 'Unknown Patient';
  }

  /**
   * Calculate and format patient age
   */
  getAge(): number | null {
    if (!this.patient?.birthDate) {
      return null;
    }

    const birthDate = new Date(this.patient.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 0 ? age : null;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Format gender for display
   */
  formatGender(gender: string): string {
    return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
  }

  /**
   * Get Medical Record Number (MRN)
   */
  getMedicalRecordNumber(): string | null {
    if (!this.patient?.identifier) {
      return null;
    }

    // Look for MRN in identifiers
    const mrnIdentifier = this.patient.identifier.find((id) =>
      id.type?.coding?.some(
        (coding) =>
          coding.code === 'MR' ||
          coding.display?.toLowerCase().includes('medical record'),
      ),
    );

    return mrnIdentifier?.value ?? null;
  }

  /**
   * Check if patient has contact information
   */
  hasContactInfo(): boolean {
    return !!this.patient?.telecom?.length;
  }

  /**
   * Get formatted contact information
   */
  getContactInfo(): Array<{ type: string; value: string }> {
    if (!this.patient?.telecom) {
      return [];
    }

    return this.patient.telecom.map((contact) => ({
      type: contact.system ?? 'unknown',
      value: contact.value ?? 'N/A',
    }));
  }

  /**
   * Check if patient has addresses
   */
  hasAddresses(): boolean {
    return !!this.patient?.address?.length;
  }

  /**
   * Get formatted addresses
   */
  getAddresses(): Array<{ type: string; text: string }> {
    if (!this.patient?.address) {
      return [];
    }

    return this.patient.address.map((addr) => {
      const parts = [
        ...(addr.line ?? []),
        addr.city,
        addr.state,
        addr.postalCode,
        addr.country,
      ].filter(Boolean);

      return {
        type: addr.use ?? 'unknown',
        text: parts.join(', '),
      };
    });
  }

  /**
   * Check if metadata should be shown
   */
  hasMetadata(): boolean {
    return !!(
      this.context?.clientId ||
      this.context?.serverUrl ||
      this.context?.scope
    );
  }

  /**
   * Navigate to authentication
   */
  navigateToAuth(): void {
    // In a real app, this would navigate to the auth component
    window.location.href = '/smart-launch';
  }
}
