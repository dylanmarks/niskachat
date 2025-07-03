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
  templateUrl: './patient-summary.component.html',
  styleUrl: './patient-summary.component.scss',
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
