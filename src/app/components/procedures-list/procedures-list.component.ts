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
  Procedure,
} from '../../services/fhir-client.service';
import { logger } from '../../utils/logger';

@Component({
  selector: 'app-procedures-list',
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
  templateUrl: './procedures-list.component.html',
  styleUrls: ['./procedures-list.component.scss'],
})
export class ProceduresListComponent implements OnInit, OnDestroy {
  procedures: Procedure[] = [];
  context: FhirContext | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  selectedProcedure: Procedure | null = null;
  selectedProcedureId: string | null = null;
  displayedColumns: string[] = ['procedure', 'status', 'date', 'actions'];

  private destroy$ = new Subject<void>();

  constructor(private fhirClient: FhirClientService) {}

  ngOnInit(): void {
    // Subscribe to FHIR context changes
    this.fhirClient.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((context) => {
        this.context = context;
        if (context?.authenticated && context.patient) {
          void this.loadProcedures();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadProcedures(): Promise<void> {
    if (!this.fhirClient.isAuthenticated()) {
      this.errorMessage =
        'Not authenticated. Please complete SMART on FHIR login.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const procedures = await firstValueFrom(this.fhirClient.getProcedures());
      this.procedures = this.sortProceduresByDateAndType(procedures ?? []);
    } catch (error) {
      logger.error('Error loading procedures:', error);
      this.errorMessage = `Failed to load procedures: ${String(error)}`;
    } finally {
      this.isLoading = false;
    }
  }

  private sortProceduresByDateAndType(procedures: Procedure[]): Procedure[] {
    return procedures.sort((a, b) => {
      // First sort by date (most recent first)
      const dateA = this.getProcedureDate(a);
      const dateB = this.getProcedureDate(b);

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

      // Then sort by procedure name
      const procedureA = this.getProcedureName(a);
      const procedureB = this.getProcedureName(b);
      return procedureA.localeCompare(procedureB);
    });
  }

  selectProcedure(procedure: Procedure): void {
    this.selectedProcedureId = procedure.id || null;
    this.selectedProcedure = procedure;
  }

  clearSelection(): void {
    this.selectedProcedureId = null;
    this.selectedProcedure = null;
  }

  getProcedureName(procedure: Procedure): string {
    if (procedure.code?.text) {
      return procedure.code.text;
    }

    if (procedure.code?.coding?.[0]?.display) {
      return procedure.code.coding[0].display;
    }

    if (procedure.code?.coding?.[0]?.code) {
      return procedure.code.coding[0].code;
    }

    return 'Unknown Procedure';
  }

  getProcedureStatus(procedure: Procedure): string {
    const status = procedure.status;
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'preparation':
        return 'In Preparation';
      case 'in-progress':
        return 'In Progress';
      case 'not-done':
        return 'Not Done';
      case 'on-hold':
        return 'On Hold';
      case 'stopped':
        return 'Stopped';
      case 'entered-in-error':
        return 'Error';
      case 'unknown':
        return 'Unknown';
      default:
        return status ?? 'Unknown';
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'preparation':
        return 'status-preparation';
      case 'in-progress':
        return 'status-in-progress';
      case 'not-done':
        return 'status-not-done';
      case 'on-hold':
        return 'status-on-hold';
      case 'stopped':
        return 'status-stopped';
      case 'entered-in-error':
        return 'status-error';
      case 'unknown':
        return 'status-unknown';
      default:
        return 'status-unknown';
    }
  }

  getProcedureDate(procedure: Procedure): string | null {
    if (procedure.performedDateTime) {
      return procedure.performedDateTime;
    }
    if (procedure.performedPeriod?.start) {
      return procedure.performedPeriod.start;
    }
    if (procedure.performedString) {
      return procedure.performedString;
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

  getCategoryText(procedure: Procedure): string {
    if (!procedure.category) return '';

    return (
      procedure.category.text ||
      procedure.category.coding?.[0]?.display ||
      procedure.category.coding?.[0]?.code ||
      ''
    );
  }

  getLocationText(procedure: Procedure): string {
    return procedure.location?.display || '';
  }

  getPerformerText(procedure: Procedure): string {
    if (!procedure.performer || procedure.performer.length === 0) return '';

    const performers = procedure.performer.map(
      (performer) => performer.actor.display || 'Unknown Performer',
    );

    return performers.join(', ');
  }

  getReasonText(procedure: Procedure): string {
    const reasons: string[] = [];

    if (procedure.reasonCode) {
      procedure.reasonCode.forEach((reason) => {
        if (reason.text) {
          reasons.push(reason.text);
        } else if (reason.coding?.[0]?.display) {
          reasons.push(reason.coding[0].display);
        }
      });
    }

    if (procedure.reasonReference) {
      procedure.reasonReference.forEach((ref) => {
        if (ref.display) {
          reasons.push(ref.display);
        }
      });
    }

    return reasons.join(', ');
  }

  getBodySiteText(procedure: Procedure): string {
    if (!procedure.bodySite || procedure.bodySite.length === 0) return '';

    const bodySites = procedure.bodySite
      .map(
        (site) =>
          site.text || site.coding?.[0]?.display || site.coding?.[0]?.code,
      )
      .filter(Boolean);

    return bodySites.join(', ');
  }

  getOutcomeText(procedure: Procedure): string {
    if (!procedure.outcome) return '';

    return (
      procedure.outcome.text ||
      procedure.outcome.coding?.[0]?.display ||
      procedure.outcome.coding?.[0]?.code ||
      ''
    );
  }

  getProcedureCodes(
    procedure: Procedure,
  ): { system: string; code: string; display?: string }[] {
    const codings = procedure.code?.coding ?? [];
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
      'http://www.ama-assn.org/go/cpt': 'CPT',
      'http://hl7.org/fhir/sid/icd-10-pcs': 'ICD-10-PCS',
      'http://loinc.org': 'LOINC',
    };
    return systems[systemUrl ?? ''] ?? systemUrl ?? 'Unknown';
  }

  trackProcedure(_index: number, procedure: Procedure): string {
    return procedure.id ?? _index.toString();
  }

  hasComplications(procedure: Procedure): boolean {
    return !!(procedure.complication && procedure.complication.length > 0);
  }

  getComplicationsText(procedure: Procedure): string {
    if (!procedure.complication || procedure.complication.length === 0)
      return '';

    const complications = procedure.complication
      .map(
        (complication) =>
          complication.text ||
          complication.coding?.[0]?.display ||
          complication.coding?.[0]?.code,
      )
      .filter(Boolean);

    return complications.join(', ');
  }

  hasDevices(procedure: Procedure): boolean {
    return !!(procedure.focalDevice && procedure.focalDevice.length > 0);
  }

  getDevicesText(procedure: Procedure): string {
    if (!procedure.focalDevice || procedure.focalDevice.length === 0) return '';

    const devices = procedure.focalDevice
      .map((device) => {
        if (device.manipulated?.display) {
          return `${device.action?.text || 'Device'}: ${device.manipulated.display}`;
        }
        return device.action?.text || 'Device';
      })
      .filter(Boolean);

    return devices.join(', ');
  }
}
