import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './conditions-list.component.html',
  styleUrls: ['./conditions-list.component.scss'],
})
export class ConditionsListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isLoading = false;
  errorMessage = '';
  conditions: Condition[] = [];
  context: FhirContext | null = null;
  selectedConditionId: string | null = null;
  selectedCondition: Condition | null = null;
  displayedColumns: string[] = [
    'name',
    'status',
    'onset',
    'recorded',
    'verification',
    'actions',
  ];

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
      case 'recurrence':
        return 'status-recurrence';
      case 'remission':
        return 'status-remission';
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
   * Get onset date display
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

  /**
   * Check if condition has codings
   */
  hasCodings(condition: Condition): boolean {
    return !!(condition.code?.coding && condition.code.coding.length > 0);
  }

  /**
   * Get all codings for a condition
   */
  getCodings(
    condition: Condition,
  ): { system: string; code: string; display?: string }[] {
    if (!this.hasCodings(condition)) {
      return [];
    }

    return (
      condition.code?.coding?.map((coding) => {
        const result: { system: string; code: string; display?: string } = {
          system: this.getSystemName(coding.system || ''),
          code: coding.code || '',
        };
        if (coding.display) {
          result.display = coding.display;
        }
        return result;
      }) || []
    );
  }

  /**
   * Get human-readable system name
   */
  getSystemName(system: string): string {
    const systemNames: Record<string, string> = {
      'http://snomed.info/sct': 'SNOMED CT',
      'http://hl7.org/fhir/sid/icd-10-cm': 'ICD-10-CM',
      'http://hl7.org/fhir/sid/icd-9-cm': 'ICD-9-CM',
    };
    return systemNames[system] || system;
  }

  /**
   * Select condition for details view
   */
  selectCondition(condition: Condition): void {
    this.selectedConditionId = condition.id || null;
    this.selectedCondition = condition;
  }

  /**
   * Clear condition selection
   */
  clearSelection(): void {
    this.selectedConditionId = null;
    this.selectedCondition = null;
  }

  /**
   * Track function for ngFor performance
   */
  trackCondition(index: number, condition: Condition): string {
    return condition.id || index.toString();
  }
}
