import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChatComponent } from './components/chat/chat.component';
import { ConditionsListComponent } from './components/conditions-list/conditions-list.component';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { MedicationsListComponent } from './components/medications-list/medications-list.component';
import { ObservationsChartComponent } from './components/observations-chart/observations-chart.component';
import { PatientSummaryComponent } from './components/patient-summary/patient-summary.component';
import { SmartLaunchComponent } from './components/smart-launch/smart-launch.component';
import { FhirClientService, FhirContext } from './services/fhir-client.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    SmartLaunchComponent,
    PatientSummaryComponent,
    ConditionsListComponent,
    ObservationsChartComponent,
    MedicationsListComponent,
    FileUploadComponent,
    ChatComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  protected title = 'NiskaChat';
  private destroy$ = new Subject<void>();

  context: FhirContext | null = null;
  isSmartSsoActive = false;
  isSummarizing = false;

  @ViewChild(PatientSummaryComponent)
  patientSummaryComponent!: PatientSummaryComponent;

  private fhirClient = inject(FhirClientService);

  constructor() {
    this.checkForSmartSso();
  }

  ngOnInit(): void {
    this.fhirClient.context$.pipe(takeUntil(this.destroy$)).subscribe((ctx) => {
      this.context = ctx;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkForSmartSso(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const isCallback = window.location.pathname.includes('callback');
    const hasLaunch = urlParams.has('launch');
    const hasCode = urlParams.has('code');
    const hasIss = urlParams.has('iss');

    this.isSmartSsoActive = isCallback || hasLaunch || hasCode || hasIss;
  }

  getPatientDisplayName(): string {
    if (!this.context?.patient?.name?.[0]) {
      return 'Unknown Patient';
    }

    const name = this.context.patient.name[0];
    const given = name.given?.join(' ') ?? '';
    const family = name.family ?? '';

    return `${given} ${family}`.trim() || 'Unknown Patient';
  }

  getPatientHeaderDetails(): string {
    if (!this.context?.patient) {
      return '';
    }

    const patient = this.context.patient;
    const parts = [];

    // Add patient name with Pt: prefix
    parts.push(`Pt: ${this.getPatientDisplayName()}`);

    // Add gender
    if (patient.gender) {
      parts.push(patient.gender.charAt(0).toUpperCase());
    }

    // Add birth date
    if (patient.birthDate) {
      parts.push(`DOB ${patient.birthDate}`);
    }

    // Add patient ID
    if (patient.id) {
      parts.push(`Patient ID: ${patient.id}`);
    }

    return parts.join(', ');
  }

  hasContactInfo(): boolean {
    return !!this.context?.patient?.telecom?.length;
  }

  getContactInfo(): { type: string; value: string }[] {
    if (!this.context?.patient?.telecom) {
      return [];
    }

    return this.context.patient.telecom.map((contact) => ({
      type: contact.system ?? 'Contact',
      value: contact.value ?? 'N/A',
    }));
  }

  hasAddresses(): boolean {
    return !!this.context?.patient?.address?.length;
  }

  getAddresses(): { type: string; text: string }[] {
    if (!this.context?.patient?.address) {
      return [];
    }

    return this.context.patient.address.map((addr) => {
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

  onSummarizeClick(): void {
    if (this.patientSummaryComponent) {
      this.isSummarizing = true;
      this.patientSummaryComponent.generateSummary().finally(() => {
        this.isSummarizing = false;
      });
    }
  }
}
