import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  FhirClientService,
  FhirContext,
  MedicationRequest,
} from '../../services/fhir-client.service';

@Component({
  selector: 'app-medications-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './medications-list.component.html',
  styleUrls: ['./medications-list.component.scss'],
})
export class MedicationsListComponent implements OnInit, OnDestroy {
  medications: MedicationRequest[] = [];
  context: FhirContext | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  selectedMedication: MedicationRequest | null = null;
  selectedMedicationId: string | null = null;
  showInactive = false;
  displayedColumns: string[] = ['name', 'status', 'date', 'actions'];

  private destroy$ = new Subject<void>();

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    // Subscribe to FHIR context changes
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (context?.authenticated && context.patient) {
          this.loadMedications();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadMedications(): Promise<void> {
    if (!this.fhirClient.isAuthenticated()) {
      this.errorMessage =
        'Not authenticated. Please complete SMART on FHIR login.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const medications = await firstValueFrom(
        this.fhirClient.getMedicationRequests(),
      );
      this.medications = this.sortMedicationsByDate(medications || []);
    } catch (error) {
      this.errorMessage = `Failed to load medications: ${error}`;
      console.error('Error loading medications:', error);
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
    this.selectedMedicationId = medication.id || null;
    this.selectedMedication = medication;
  }

  clearSelection(): void {
    this.selectedMedicationId = null;
    this.selectedMedication = null;
  }

  getMedicationName(medication: MedicationRequest): string {
    // Try medicationCodeableConcept first
    if (medication.medicationCodeableConcept?.text) {
      return medication.medicationCodeableConcept.text;
    }

    if (medication.medicationCodeableConcept?.coding?.[0]?.display) {
      return medication.medicationCodeableConcept.coding[0].display;
    }

    if (medication.medicationCodeableConcept?.coding?.[0]?.code) {
      return medication.medicationCodeableConcept.coding[0].code;
    }

    // Try medicationReference if available
    if (medication.medicationReference?.display) {
      return medication.medicationReference.display;
    }

    return 'Unknown Medication';
  }

  getMedicationStatus(medication: MedicationRequest): string {
    const status = medication.status;
    switch (status) {
      case 'active':
        return 'Active';
      case 'on-hold':
        return 'On Hold';
      case 'cancelled':
        return 'Cancelled';
      case 'completed':
        return 'Completed';
      case 'entered-in-error':
        return 'Error';
      case 'stopped':
        return 'Stopped';
      case 'draft':
        return 'Draft';
      case 'unknown':
        return 'Unknown';
      default:
        return status || 'Unknown';
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'on-hold':
        return 'status-on-hold';
      case 'cancelled':
        return 'status-cancelled';
      case 'completed':
        return 'status-completed';
      case 'entered-in-error':
        return 'status-error';
      case 'stopped':
        return 'status-stopped';
      case 'draft':
        return 'status-draft';
      case 'unknown':
        return 'status-unknown';
      default:
        return 'status-unknown';
    }
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  }

  getDosageText(medication: MedicationRequest): string {
    const dosageInstruction = medication.dosageInstruction?.[0];
    if (!dosageInstruction) return '';

    const parts: string[] = [];

    if (dosageInstruction.text) {
      return dosageInstruction.text;
    }

    if (dosageInstruction.doseAndRate?.[0]?.doseQuantity) {
      const dose = dosageInstruction.doseAndRate[0].doseQuantity;
      parts.push(`${dose.value} ${dose.unit || dose.code || ''}`);
    }

    return parts.join(' ');
  }

  getFrequencyText(medication: MedicationRequest): string {
    const dosageInstruction = medication.dosageInstruction?.[0];
    if (!dosageInstruction?.timing) return '';

    const timing = dosageInstruction.timing;

    if (timing.repeat?.frequency && timing.repeat?.period) {
      const frequency = timing.repeat.frequency;
      const period = timing.repeat.period;
      const periodUnit = timing.repeat.periodUnit || 'day';
      return `${frequency} times per ${period} ${periodUnit}${period > 1 ? 's' : ''}`;
    }

    return '';
  }

  getRouteText(medication: MedicationRequest): string {
    const route = medication.dosageInstruction?.[0]?.route;
    return route?.text || route?.coding?.[0]?.display || '';
  }

  getQuantityText(medication: MedicationRequest): string {
    const quantity = medication.dispenseRequest?.quantity;
    if (!quantity) return '';

    return `${quantity.value} ${quantity.unit || quantity.code || ''}`;
  }

  getReasonText(medication: MedicationRequest): string {
    const reasons: string[] = [];

    if (medication.reasonReference) {
      medication.reasonReference.forEach((ref) => {
        if (ref.display) {
          reasons.push(ref.display);
        }
      });
    }

    if (medication.reasonCode) {
      medication.reasonCode.forEach((code) => {
        if (code.text) {
          reasons.push(code.text);
        } else if (code.coding?.[0]?.display) {
          reasons.push(code.coding[0].display);
        }
      });
    }

    return reasons.join(', ');
  }

  getMedicationCodes(
    medication: MedicationRequest,
  ): { system: string; code: string; display?: string }[] {
    const codings = medication.medicationCodeableConcept?.coding || [];
    return codings.map((coding) => {
      const result: { system: string; code: string; display?: string } = {
        system: this.getCodeSystem(coding.system),
        code: coding.code || '',
      };
      if (coding.display) {
        result.display = coding.display;
      }
      return result;
    });
  }

  getCodeSystem(systemUrl?: string): string {
    const systems: Record<string, string> = {
      'http://www.nlm.nih.gov/research/umls/rxnorm': 'RxNorm',
      'http://hl7.org/fhir/sid/ndc': 'NDC',
      'http://snomed.info/sct': 'SNOMED CT',
    };
    return systems[systemUrl || ''] || systemUrl || 'Unknown';
  }

  trackMedication(_index: number, medication: MedicationRequest): string {
    return medication.id || _index.toString();
  }

  toggleInactive(): void {
    this.showInactive = !this.showInactive;
  }

  get activeMedications(): MedicationRequest[] {
    return this.medications.filter(
      (med) => med.status === 'active' || med.status === 'on-hold',
    );
  }

  get inactiveMedications(): MedicationRequest[] {
    return this.medications.filter(
      (med) => med.status !== 'active' && med.status !== 'on-hold',
    );
  }
}
