import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatComponent } from './components/chat/chat.component';
import { ConditionsListComponent } from './components/conditions-list/conditions-list.component';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { MedicationsListComponent } from './components/medications-list/medications-list.component';
import { ObservationsChartComponent } from './components/observations-chart/observations-chart.component';
import { PatientSummaryComponent } from './components/patient-summary/patient-summary.component';
import { SmartLaunchComponent } from './components/smart-launch/smart-launch.component';

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
}
