import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'NiskaChat';

  context: FhirContext | null = null;

  private fhirClient = inject(FhirClientService);

  constructor() {
    this.fhirClient.context$.subscribe((ctx) => (this.context = ctx));
  }
}
