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
  AllergyIntolerance,
  FhirClientService,
  FhirContext,
} from '../../services/fhir-client.service';
import { logger } from '../../utils/logger';

@Component({
  selector: 'app-allergies-list',
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
  templateUrl: './allergies-list.component.html',
  styleUrls: ['./allergies-list.component.scss'],
})
export class AllergiesListComponent implements OnInit, OnDestroy {
  allergies: AllergyIntolerance[] = [];
  context: FhirContext | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  selectedAllergy: AllergyIntolerance | null = null;
  selectedAllergyId: string | null = null;
  showInactive = false;
  displayedColumns: string[] = ['name', 'severity', 'date', 'actions'];

  private destroy$ = new Subject<void>();

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    // Subscribe to FHIR context changes
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (context?.authenticated && context.patient) {
          void this.loadAllergies();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadAllergies(): Promise<void> {
    if (!this.fhirClient.isAuthenticated()) {
      this.errorMessage =
        'Not authenticated. Please complete SMART on FHIR login.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const allergies = await firstValueFrom(
        this.fhirClient.getAllergyIntolerances(),
      );
      this.allergies = this.sortAllergiesBySeverityAndDate(allergies ?? []);
    } catch (error) {
      logger.error('Error loading allergies:', error);
      this.errorMessage = `Failed to load allergies: ${String(error)}`;
    } finally {
      this.isLoading = false;
    }
  }

  private sortAllergiesBySeverityAndDate(
    allergies: AllergyIntolerance[],
  ): AllergyIntolerance[] {
    return allergies.sort((a, b) => {
      // First sort by criticality (severity)
      const severityOrder = ['high', 'low', 'unable-to-assess'];
      const severityA = a.criticality
        ? severityOrder.indexOf(a.criticality)
        : 999;
      const severityB = b.criticality
        ? severityOrder.indexOf(b.criticality)
        : 999;

      if (severityA !== severityB) {
        return severityA - severityB;
      }

      // Then sort by recorded date (most recent first)
      const dateA = a.recordedDate ? new Date(a.recordedDate).getTime() : 0;
      const dateB = b.recordedDate ? new Date(b.recordedDate).getTime() : 0;
      return dateB - dateA;
    });
  }

  selectAllergy(allergy: AllergyIntolerance): void {
    this.selectedAllergyId = allergy.id || null;
    this.selectedAllergy = allergy;
  }

  clearSelection(): void {
    this.selectedAllergyId = null;
    this.selectedAllergy = null;
  }

  getAllergyName(allergy: AllergyIntolerance): string {
    if (allergy.code?.text) {
      return allergy.code.text;
    }

    if (allergy.code?.coding?.[0]?.display) {
      return allergy.code.coding[0].display;
    }

    if (allergy.code?.coding?.[0]?.code) {
      return allergy.code.coding[0].code;
    }

    return 'Unknown Allergen';
  }

  getAllergySeverity(allergy: AllergyIntolerance): string {
    const criticality = allergy.criticality;
    switch (criticality) {
      case 'high':
        return 'High';
      case 'low':
        return 'Low';
      case 'unable-to-assess':
        return 'Unable to Assess';
      default:
        return 'Unknown';
    }
  }

  getSeverityClass(criticality?: string): string {
    switch (criticality) {
      case 'high':
        return 'severity-high';
      case 'low':
        return 'severity-low';
      case 'unable-to-assess':
        return 'severity-unknown';
      default:
        return 'severity-unknown';
    }
  }

  getClinicalStatus(allergy: AllergyIntolerance): string {
    const status = allergy.clinicalStatus?.coding?.[0]?.code;
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'resolved':
        return 'Resolved';
      default:
        return status ?? 'Unknown';
    }
  }

  getStatusClass(allergy: AllergyIntolerance): string {
    const status = allergy.clinicalStatus?.coding?.[0]?.code;
    switch (status) {
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

  getReactionText(allergy: AllergyIntolerance): string {
    const reactions: string[] = [];

    if (allergy.reaction) {
      allergy.reaction.forEach((reaction) => {
        if (reaction.manifestation) {
          reaction.manifestation.forEach((manifestation) => {
            if (manifestation.text) {
              reactions.push(manifestation.text);
            } else if (manifestation.coding?.[0]?.display) {
              reactions.push(manifestation.coding[0].display);
            }
          });
        }
      });
    }

    return reactions.join(', ');
  }

  getCategoryText(allergy: AllergyIntolerance): string {
    if (!allergy.category || allergy.category.length === 0) return '';

    return allergy.category
      .map((cat) => {
        switch (cat) {
          case 'food':
            return 'Food';
          case 'medication':
            return 'Medication';
          case 'environment':
            return 'Environmental';
          case 'biologic':
            return 'Biologic';
          default:
            return cat;
        }
      })
      .join(', ');
  }

  getTypeText(allergy: AllergyIntolerance): string {
    switch (allergy.type) {
      case 'allergy':
        return 'Allergy';
      case 'intolerance':
        return 'Intolerance';
      default:
        return allergy.type ?? 'Unknown';
    }
  }

  getAllergyCodes(
    allergy: AllergyIntolerance,
  ): { system: string; code: string; display?: string }[] {
    const codings = allergy.code?.coding ?? [];
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
      'http://snomed.info/sct': 'SNOMED CT',
      'http://www.nlm.nih.gov/research/umls/rxnorm': 'RxNorm',
      'http://hl7.org/fhir/sid/ndc': 'NDC',
      'http://fdasis.nlm.nih.gov': 'UNII',
    };
    return systems[systemUrl ?? ''] ?? systemUrl ?? 'Unknown';
  }

  trackAllergy(_index: number, allergy: AllergyIntolerance): string {
    return allergy.id ?? _index.toString();
  }

  toggleInactive(): void {
    this.showInactive = !this.showInactive;
  }

  get activeAllergies(): AllergyIntolerance[] {
    return this.allergies.filter((allergy) => {
      const status = allergy.clinicalStatus?.coding?.[0]?.code;
      return status === 'active' || !status;
    });
  }

  get inactiveAllergies(): AllergyIntolerance[] {
    return this.allergies.filter((allergy) => {
      const status = allergy.clinicalStatus?.coding?.[0]?.code;
      return status === 'inactive' || status === 'resolved';
    });
  }
}
