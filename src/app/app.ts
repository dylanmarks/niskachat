import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
export class App {
  protected title = 'NiskaChat';

  context: FhirContext | null = null;
  isSmartSsoActive = false;

  private fhirClient = inject(FhirClientService);

  constructor() {
    this.fhirClient.context$.subscribe((ctx) => (this.context = ctx));
    this.checkForSmartSso();
  }

  private checkForSmartSso(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const isCallback = window.location.pathname.includes('callback');
    const hasLaunch = urlParams.has('launch');
    const hasCode = urlParams.has('code');
    const hasIss = urlParams.has('iss');

    this.isSmartSsoActive = isCallback || hasLaunch || hasCode || hasIss;
  }
}
