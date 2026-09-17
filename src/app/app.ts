import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AllergiesListComponent } from './components/allergies-list/allergies-list.component';
import { ChatComponent } from './components/chat/chat.component';
import { ConditionsListComponent } from './components/conditions-list/conditions-list.component';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { ImmunizationsListComponent } from './components/immunizations-list/immunizations-list.component';
import { MedicationsListComponent } from './components/medications-list/medications-list.component';
import { ObservationsChartComponent } from './components/observations-chart/observations-chart.component';
import { PatientSummaryComponent } from './components/patient-summary/patient-summary.component';
import { ProceduresListComponent } from './components/procedures-list/procedures-list.component';
import { SmartLaunchComponent } from './components/smart-launch/smart-launch.component';
import { TasksListComponent } from './components/tasks-list/tasks-list.component';
import { FhirClientService, FhirContext } from './services/fhir-client.service';
import { ThemeService } from './services/theme.service';

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
    AllergiesListComponent,
    ImmunizationsListComponent,
    ProceduresListComponent,
    ObservationsChartComponent,
    MedicationsListComponent,
    FileUploadComponent,
    ChatComponent,
    TasksListComponent,
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
  isProcessing = false;
  selectedTabIndex = 0; // 0 = Records, 1 = Discuss, 2 = Tasks

  @ViewChild(PatientSummaryComponent)
  patientSummaryComponent!: PatientSummaryComponent;

  @ViewChild('chatComponent')
  chatComponent!: ChatComponent;

  private fhirClient = inject(FhirClientService);
  protected themeService = inject(ThemeService);

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
    const firstLine = [];

    // Add patient name with Pt: prefix
    firstLine.push(`Pt: ${this.getPatientDisplayName()}`);

    // Add gender
    if (patient.gender) {
      firstLine.push(patient.gender.charAt(0).toUpperCase());
    }

    // Add birth date
    if (patient.birthDate) {
      firstLine.push(`DOB ${patient.birthDate}`);
    }

    let result = firstLine.join(', ');

    // Add patient ID on a new line
    if (patient.id) {
      result += `\nPatient ID: ${patient.id}`;
    }

    return result;
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
    this.selectedTabIndex = 1; // Switch to Discuss tab
    this.isSummarizing = true;

    // Wait for the chat component to be rendered
    setTimeout(() => {
      if (this.chatComponent) {
        this.chatComponent.currentMessage = 'summarize this patient';
        void this.chatComponent.sendMessage().finally(() => {
          this.isSummarizing = false;
        });
      }
    }, 100);
  }

  onNextBestActionClick(): void {
    this.selectedTabIndex = 1; // Switch to Discuss tab
    this.isProcessing = true;

    // Wait for the chat component to be rendered
    setTimeout(() => {
      if (this.chatComponent) {
        // Set the chat input and send the NBA message
        this.chatComponent.currentMessage =
          'Please suggest next best actions and clinical recommendations for this patient.';
        void this.chatComponent.sendMessage();
        this.isProcessing = false;
      }
    }, 100);
  }

  onDiscussClick(): void {
    this.selectedTabIndex = 1; // Switch to Discuss tab

    // Wait for the chat component to be rendered then focus input
    setTimeout(() => {
      this.focusChatInput();
    }, 100);
  }

  private focusChatInput(): void {
    // Find the textarea input in the chat component and focus it
    const chatTextarea = document.querySelector('.chat-input');
    if (chatTextarea && chatTextarea instanceof HTMLTextAreaElement) {
      chatTextarea.focus();
    }
  }
}
