import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConditionsListComponent } from './components/conditions-list/conditions-list.component';
import { MedicationsListComponent } from './components/medications-list/medications-list.component';
import { ObservationsChartComponent } from './components/observations-chart/observations-chart.component';
import { PatientSummaryComponent } from './components/patient-summary/patient-summary.component';
import { SmartLaunchComponent } from './components/smart-launch/smart-launch.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    SmartLaunchComponent,
    PatientSummaryComponent,
    ConditionsListComponent,
    MedicationsListComponent,
    ObservationsChartComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'NiskaChat';
}
