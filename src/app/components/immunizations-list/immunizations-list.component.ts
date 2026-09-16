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
  Immunization,
} from '../../services/fhir-client.service';
import { logger } from '../../utils/logger';

@Component({
  selector: 'app-immunizations-list',
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
  templateUrl: './immunizations-list.component.html',
  styleUrls: ['./immunizations-list.component.scss'],
})
export class ImmunizationsListComponent implements OnInit, OnDestroy {
  immunizations: Immunization[] = [];
  context: FhirContext | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  selectedImmunization: Immunization | null = null;
  selectedImmunizationId: string | null = null;
  showNotAdministered = false;
  displayedColumns: string[] = ['vaccine', 'status', 'date', 'actions'];

  private destroy$ = new Subject<void>();

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    // Subscribe to FHIR context changes
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (context?.authenticated && context.patient) {
          void this.loadImmunizations();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadImmunizations(): Promise<void> {
    if (!this.fhirClient.isAuthenticated()) {
      this.errorMessage =
        'Not authenticated. Please complete SMART on FHIR login.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const immunizations = await firstValueFrom(
        this.fhirClient.getImmunizations(),
      );
      this.immunizations = this.sortImmunizationsByDateAndVaccine(
        immunizations ?? [],
      );
    } catch (error) {
      logger.error('Error loading immunizations:', error);
      this.errorMessage = `Failed to load immunizations: ${String(error)}`;
    } finally {
      this.isLoading = false;
    }
  }

  private sortImmunizationsByDateAndVaccine(
    immunizations: Immunization[],
  ): Immunization[] {
    return immunizations.sort((a, b) => {
      // First sort by date (most recent first)
      const dateA = this.getImmunizationDate(a);
      const dateB = this.getImmunizationDate(b);

      if (dateA && dateB) {
        const timeA = new Date(dateA).getTime();
        const timeB = new Date(dateB).getTime();
        if (timeA !== timeB) {
          return timeB - timeA; // Most recent first
        }
      } else if (dateA && !dateB) {
        return -1; // A has date, B doesn't - A comes first
      } else if (!dateA && dateB) {
        return 1; // B has date, A doesn't - B comes first
      }

      // Then sort by vaccine name
      const vaccineA = this.getVaccineName(a);
      const vaccineB = this.getVaccineName(b);
      return vaccineA.localeCompare(vaccineB);
    });
  }

  selectImmunization(immunization: Immunization): void {
    this.selectedImmunizationId = immunization.id || null;
    this.selectedImmunization = immunization;
  }

  clearSelection(): void {
    this.selectedImmunizationId = null;
    this.selectedImmunization = null;
  }

  getVaccineName(immunization: Immunization): string {
    if (immunization.vaccineCode?.text) {
      return immunization.vaccineCode.text;
    }

    if (immunization.vaccineCode?.coding?.[0]?.display) {
      return immunization.vaccineCode.coding[0].display;
    }

    if (immunization.vaccineCode?.coding?.[0]?.code) {
      return immunization.vaccineCode.coding[0].code;
    }

    return 'Unknown Vaccine';
  }

  getImmunizationStatus(immunization: Immunization): string {
    const status = immunization.status;
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'entered-in-error':
        return 'Error';
      case 'not-done':
        return 'Not Done';
      default:
        return status ?? 'Unknown';
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'entered-in-error':
        return 'status-error';
      case 'not-done':
        return 'status-not-done';
      default:
        return 'status-unknown';
    }
  }

  getImmunizationDate(immunization: Immunization): string | null {
    if (immunization.occurrenceDateTime) {
      return immunization.occurrenceDateTime;
    }
    if (immunization.recorded) {
      return immunization.recorded;
    }
    return null;
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
      logger.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }

  getManufacturerText(immunization: Immunization): string {
    return immunization.manufacturer?.display || '';
  }

  getLotNumber(immunization: Immunization): string {
    return immunization.lotNumber || '';
  }

  getDoseQuantityText(immunization: Immunization): string {
    if (!immunization.doseQuantity) return '';

    const dose = immunization.doseQuantity;
    return `${dose.value || ''} ${dose.unit || dose.code || ''}`.trim();
  }

  getSiteText(immunization: Immunization): string {
    if (!immunization.site) return '';

    return (
      immunization.site.text ||
      immunization.site.coding?.[0]?.display ||
      immunization.site.coding?.[0]?.code ||
      ''
    );
  }

  getRouteText(immunization: Immunization): string {
    if (!immunization.route) return '';

    return (
      immunization.route.text ||
      immunization.route.coding?.[0]?.display ||
      immunization.route.coding?.[0]?.code ||
      ''
    );
  }

  getReasonText(immunization: Immunization): string {
    const reasons: string[] = [];

    if (immunization.reasonCode) {
      immunization.reasonCode.forEach((reason) => {
        if (reason.text) {
          reasons.push(reason.text);
        } else if (reason.coding?.[0]?.display) {
          reasons.push(reason.coding[0].display);
        }
      });
    }

    if (immunization.reasonReference) {
      immunization.reasonReference.forEach((ref) => {
        if (ref.display) {
          reasons.push(ref.display);
        }
      });
    }

    return reasons.join(', ');
  }

  getPerformerText(immunization: Immunization): string {
    if (!immunization.performer || immunization.performer.length === 0)
      return '';

    const performers = immunization.performer.map(
      (performer) => performer.actor.display || 'Unknown Performer',
    );

    return performers.join(', ');
  }

  getVaccineCodes(
    immunization: Immunization,
  ): { system: string; code: string; display?: string }[] {
    const codings = immunization.vaccineCode?.coding ?? [];
    return codings.map((coding) => {
      const result: { system: string; code: string; display?: string } = {
        system: this.getCodeSystem(coding.system),
        code: coding.code ?? '',
      };
      if (coding.display) {
        result.display = coding.display;
      }
      return result;
    });
  }

  getCodeSystem(systemUrl?: string): string {
    const systems: Record<string, string> = {
      'http://hl7.org/fhir/sid/cvx': 'CVX',
      'http://hl7.org/fhir/sid/ndc': 'NDC',
      'http://snomed.info/sct': 'SNOMED CT',
      'http://www.nlm.nih.gov/research/umls/rxnorm': 'RxNorm',
    };
    return systems[systemUrl ?? ''] ?? systemUrl ?? 'Unknown';
  }

  trackImmunization(_index: number, immunization: Immunization): string {
    return immunization.id ?? _index.toString();
  }

  toggleNotAdministered(): void {
    this.showNotAdministered = !this.showNotAdministered;
  }

  get administeredImmunizations(): Immunization[] {
    return this.immunizations.filter(
      (immunization) => immunization.status === 'completed',
    );
  }

  get notAdministeredImmunizations(): Immunization[] {
    return this.immunizations.filter(
      (immunization) =>
        immunization.status === 'not-done' ||
        immunization.status === 'entered-in-error',
    );
  }

  getProtocolText(immunization: Immunization): string {
    if (
      !immunization.protocolApplied ||
      immunization.protocolApplied.length === 0
    )
      return '';

    const protocol = immunization.protocolApplied[0];
    if (!protocol) return '';

    const parts: string[] = [];

    if (protocol.doseNumberPositiveInt) {
      parts.push(`Dose ${protocol.doseNumberPositiveInt}`);
    } else if (protocol.doseNumberString) {
      parts.push(`Dose ${protocol.doseNumberString}`);
    }

    if (protocol.seriesDosesPositiveInt) {
      parts.push(`of ${protocol.seriesDosesPositiveInt}`);
    } else if (protocol.seriesDosesString) {
      parts.push(`of ${protocol.seriesDosesString}`);
    }

    if (protocol.targetDisease && protocol.targetDisease.length > 0) {
      const diseases = protocol.targetDisease
        .map(
          (disease) =>
            disease.text ||
            disease.coding?.[0]?.display ||
            disease.coding?.[0]?.code,
        )
        .filter(Boolean);
      if (diseases.length > 0) {
        parts.push(`for ${diseases.join(', ')}`);
      }
    }

    return parts.join(' ');
  }

  hasReactions(immunization: Immunization): boolean {
    return !!(immunization.reaction && immunization.reaction.length > 0);
  }

  getReactionsText(immunization: Immunization): string {
    if (!immunization.reaction || immunization.reaction.length === 0) return '';

    return immunization.reaction
      .map((reaction) => {
        const parts: string[] = [];
        if (reaction.date) {
          parts.push(`Date: ${this.formatDate(reaction.date)}`);
        }
        if (reaction.detail?.display) {
          parts.push(`Detail: ${reaction.detail.display}`);
        }
        if (reaction.reported !== undefined) {
          parts.push(`Reported: ${reaction.reported ? 'Yes' : 'No'}`);
        }
        return parts.join(', ');
      })
      .join('; ');
  }
}
