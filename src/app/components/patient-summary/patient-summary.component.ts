import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  FhirClientService,
  FhirContext,
  Patient,
} from '../../services/fhir-client.service';
import { logger } from '../../utils/logger';

export interface LLMSummaryResponse {
  summary: string;
  llmUsed: boolean;
  warning?: string;
  error?: string;
}

export interface HttpErrorResponse {
  error?: {
    error?: string;
    message?: string;
  };
  message?: string;
}

export interface CompressedSummaryResponse {
  compressedSummary: string;
}

@Component({
  selector: 'app-patient-summary',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-summary.component.html',
  styleUrl: './patient-summary.component.scss',
})
export class PatientSummaryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isLoading = false;
  errorMessage = '';
  patient: Patient | null = null;
  context: FhirContext | null = null;

  // Summary-related properties
  isSummarizing = false;
  summary: string | null = null;
  summaryError: string | null = null;
  summaryWarning: string | null = null;
  summaryUsedLLM = false;
  summaryTimestamp: Date | null = null;

  // Compressed summary for header display
  compressedSummary: string | null = null;

  constructor(
    private fhirClient: FhirClientService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    // Subscribe to FHIR context changes
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (context?.authenticated && context.patient) {
          this.patient = context.patient;
          this.errorMessage = '';
          // Generate compressed summary for header
          void this.generateCompressedSummary();
        } else if (context?.authenticated && !context.patient) {
          void this.loadPatient();
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
      const patient = await firstValueFrom(this.fhirClient.getPatient());
      this.patient = patient ?? null;

      // Generate compressed summary for header
      if (this.patient) {
        await this.generateCompressedSummary();
      }
    } catch (error) {
      this.errorMessage = `Failed to load patient: ${String(error)}`;
      logger.error('Error loading patient:', error);
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
    } catch {
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
  getContactInfo(): { type: string; value: string }[] {
    if (!this.patient?.telecom) {
      return [];
    }

    return this.patient.telecom.map((contact) => ({
      type: contact.system ?? 'Contact',
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
  getAddresses(): { type: string; text: string }[] {
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
        type: addr.use ?? 'Address',
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
   * Convert markdown-style bold text (**text**) to HTML
   */
  convertMarkdownToHtml(text: string | null): string {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  /**
   * Navigate to authentication
   */
  navigateToAuth(): void {
    // In a real app, this would navigate to the auth component
    window.location.href = '/smart-launch';
  }

  /**
   * Generate AI-powered summary of patient's medical history
   */
  async generateSummary(): Promise<void> {
    if (!this.patient) {
      this.summaryError = 'No patient data available to summarize';
      return;
    }

    this.isSummarizing = true;
    this.summaryError = null;
    this.summary = null;

    try {
      // Create a basic FHIR Bundle with patient data
      const bundle = {
        resourceType: 'Bundle',
        id: `bundle-${this.patient.id || 'unknown'}`,
        type: 'collection',
        entry: [
          {
            resource: this.patient,
          },
        ] as { resource: any }[],
      };

      // If we have a FHIR client, try to fetch additional resources
      if (this.fhirClient.isAuthenticated()) {
        try {
          // Try to get conditions
          const conditions = await firstValueFrom(
            this.fhirClient.getConditions(),
          );
          if (conditions) {
            conditions.forEach((condition) => {
              bundle.entry.push({ resource: condition as any });
            });
          }

          // Try to get observations
          const observations = await firstValueFrom(
            this.fhirClient.getObservations(),
          );
          if (observations) {
            observations.forEach((observation) => {
              bundle.entry.push({ resource: observation as any });
            });
          }

          // Try to get medications
          const medications = await firstValueFrom(
            this.fhirClient.getMedicationRequests(),
          );
          if (medications) {
            medications.forEach((medication) => {
              bundle.entry.push({ resource: medication as any });
            });
          }
        } catch (fetchError) {
          logger.warn('Could not fetch additional resources:', fetchError);
          // Continue with just patient data
        }
      }

      // Call the backend summarization API
      const response = await firstValueFrom(
        this.http.post<LLMSummaryResponse>('/api/llm', { bundle }),
      );

      this.summary = response.summary;
      this.summaryUsedLLM = response.llmUsed || false;
      this.summaryTimestamp = new Date();
      this.summaryWarning = response.warning || null;

      // Show warning if LLM failed
      if (response.warning) {
        logger.warn('⚠️ LLM Warning:', response.warning);
      }
    } catch (error: unknown) {
      logger.error('Error generating summary:', error);
      const httpError = error as HttpErrorResponse;
      this.summaryError =
        httpError.error?.error || httpError.message || 'Failed to generate summary';
    } finally {
      this.isSummarizing = false;
    }
  }

  /**
   * Generate compressed summary for header display
   */
  private async generateCompressedSummary(): Promise<void> {
    if (!this.patient) {
      return;
    }

    try {
      // Create a basic FHIR Bundle with patient data
      const bundle = {
        resourceType: 'Bundle',
        id: `bundle-${this.patient.id || 'unknown'}`,
        type: 'collection',
        entry: [
          {
            resource: this.patient,
          },
        ] as { resource: any }[],
      };

      // If we have a FHIR client, try to fetch additional resources
      if (this.fhirClient.isAuthenticated()) {
        try {
          // Try to get conditions
          const conditions = await firstValueFrom(
            this.fhirClient.getConditions(),
          );
          if (conditions) {
            conditions.forEach((condition) => {
              bundle.entry.push({ resource: condition as any });
            });
          }

          // Try to get observations
          const observations = await firstValueFrom(
            this.fhirClient.getObservations(),
          );
          if (observations) {
            observations.forEach((observation) => {
              bundle.entry.push({ resource: observation as any });
            });
          }

          // Try to get medications
          const medications = await firstValueFrom(
            this.fhirClient.getMedicationRequests(),
          );
          if (medications) {
            medications.forEach((medication) => {
              bundle.entry.push({ resource: medication as any });
            });
          }
        } catch (fetchError) {
          logger.warn('Could not fetch additional resources:', fetchError);
          // Continue with just patient data
        }
      }

      // Call the backend to get the compressed summary
      const response = await firstValueFrom(
        this.http.post<CompressedSummaryResponse>('/api/llm/compress', { bundle }),
      );

      this.compressedSummary = response.compressedSummary || null;
    } catch (error: unknown) {
      logger.warn('Could not generate compressed summary:', error);
      // Create a basic summary from patient data
      this.compressedSummary = this.createBasicSummary();
    }
  }

  /**
   * Create a basic summary from patient data when backend is unavailable
   */
  private createBasicSummary(): string {
    if (!this.patient) {
      return '';
    }

    const parts = [];

    // Add patient name
    const name = this.getPatientName();
    if (name !== 'Unknown Patient') {
      parts.push(`Pt: ${name}`);
    }

    // Add gender
    if (this.patient.gender) {
      parts.push(this.patient.gender.charAt(0).toUpperCase());
    }

    // Add birth date
    if (this.patient.birthDate) {
      parts.push(`DOB ${this.patient.birthDate}`);
    }

    return parts.join(', ');
  }
}
