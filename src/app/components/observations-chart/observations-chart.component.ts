import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { distinctUntilChanged, Subject, takeUntil } from 'rxjs';

import {
  FhirClientService,
  Observation,
} from '../../services/fhir-client.service';

// Register Chart.js components
Chart.register(...registerables);

interface ChartDataPoint {
  x: string; // ISO date string
  y: number;
}

interface ChartDataset {
  label: string;
  data: ChartDataPoint[];
  borderColor?: string;
  backgroundColor?: string;
  tension?: number;
}

interface ObservationChartData {
  labels?: string[];
  datasets?: ChartDataset[];
}

interface GroupedObservations {
  [key: string]: Observation[];
}

@Component({
  selector: 'app-observations-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="observations-chart-container">
      <div class="observations-header">
        <h3>Clinical Observations</h3>
        <div class="observations-controls">
          <label for="category-select">Filter by type:</label>
          <select
            id="category-select"
            [(ngModel)]="selectedCategory"
            (change)="onCategoryChange($event)"
            class="category-select"
          >
            <option value="all">All Observations</option>
            <option value="blood-pressure">Blood Pressure</option>
            <option value="a1c">Hemoglobin A1c</option>
            <option value="glucose">Glucose</option>
            <option value="weight">Weight</option>
            <option value="height">Height</option>
          </select>
        </div>
      </div>

      <div class="observations-content">
        <div *ngIf="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading observations...</p>
        </div>

        <div *ngIf="error" class="error-state">
          <div class="error-icon">⚠️</div>
          <h4>Error Loading Observations</h4>
          <p>{{ error }}</p>
          <button (click)="loadObservations()" class="retry-button">
            Try Again
          </button>
        </div>

        <div
          *ngIf="!loading && !error && observations.length === 0"
          class="empty-state"
        >
          <div class="empty-icon">📊</div>
          <h4>No Observations Found</h4>
          <p>No clinical observations are available for this patient.</p>

          <!-- Debug info -->
          <div class="debug-info">
            <p><strong>Debug Info:</strong></p>
            <p>Loading: {{ loading }}</p>
            <p>Error: {{ error || 'None' }}</p>
            <p>Observations count: {{ observations.length }}</p>
            <p>Current context: {{ getCurrentContextInfo() }}</p>
          </div>
        </div>

        <!-- Table view for all observations -->
        <div
          *ngIf="
            !loading &&
            !error &&
            observations.length > 0 &&
            selectedCategory === 'all'
          "
          class="observations-table-container"
        >
          <div class="observations-summary">
            <h4>Summary ({{ observations.length }} total observations)</h4>
            <p>Select a specific type above to view chart visualization</p>
          </div>

          <div class="table-container">
            <table class="observations-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="
                    let obs of sortedObservations;
                    trackBy: trackByObservation
                  "
                >
                  <td class="obs-type">{{ getObservationLabel(obs) }}</td>
                  <td class="obs-value">{{ formatObservationValue(obs) }}</td>
                  <td class="obs-date">{{ formatObservationDate(obs) }}</td>
                  <td class="obs-status">
                    <span [class]="'status-' + (obs.status || 'unknown')">
                      {{ obs.status || 'Unknown' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Chart view for filtered observations -->
        <div
          *ngIf="
            !loading &&
            !error &&
            observations.length > 0 &&
            selectedCategory !== 'all'
          "
          class="chart-container"
        >
          <div class="chart-header">
            <h4>{{ getCategoryDisplayName(selectedCategory) }} Trends</h4>
            <p>{{ getFilteredObservations().length }} observations</p>
          </div>
          <div class="chart-wrapper">
            <canvas #chartCanvas></canvas>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .observations-chart-container {
        margin: 16px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        padding: 24px;
      }

      .observations-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }

      .observations-header h3 {
        margin: 0;
        color: #1f2937;
        font-weight: 600;
        font-size: 1.5rem;
      }

      .observations-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .observations-controls label {
        color: #6b7280;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .category-select {
        transition: border-color 0.2s;
        cursor: pointer;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background-color: white;
        padding: 8px 12px;
        font-size: 0.875rem;
      }

      .category-select:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        border-color: #3b82f6;
      }

      .observations-content {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 400px;
      }

      .loading-state,
      .error-state,
      .empty-state {
        color: #6b7280;
        text-align: center;
      }

      .loading-spinner {
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
        border: 4px solid #f3f4f6;
        border-top: 4px solid #3b82f6;
        border-radius: 50%;
        width: 40px;
        height: 40px;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .error-icon,
      .empty-icon {
        margin-bottom: 16px;
        font-size: 3rem;
      }

      .error-state h4,
      .empty-state h4 {
        margin: 0 0 8px 0;
        color: #1f2937;
        font-weight: 600;
      }

      .retry-button {
        transition: background-color 0.2s;
        cursor: pointer;
        border: none;
        border-radius: 6px;
        background-color: #3b82f6;
        padding: 8px 16px;
        color: white;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .retry-button:hover {
        background-color: #2563eb;
      }

      /* Table styles */
      .observations-table-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 100%;
        min-height: 400px;
      }

      .observations-summary {
        margin-bottom: 16px;
        text-align: center;
      }

      .observations-summary h4 {
        margin: 0 0 8px 0;
        color: #1f2937;
        font-weight: 600;
      }

      .observations-summary p {
        margin: 0;
        color: #6b7280;
        font-size: 0.875rem;
      }

      .table-container {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow-x: auto;
      }

      .observations-table {
        border-collapse: collapse;
        background: white;
        width: 100%;
      }

      .observations-table th {
        border-bottom: 1px solid #e5e7eb;
        background-color: #f8fafc;
        padding: 12px 16px;
        color: #374151;
        font-weight: 600;
        font-size: 0.875rem;
        text-align: left;
      }

      .observations-table td {
        border-bottom: 1px solid #f3f4f6;
        padding: 12px 16px;
        color: #1f2937;
        font-size: 0.875rem;
      }

      .observations-table tr:hover {
        background-color: #f8fafc;
      }

      .obs-type {
        color: #1f2937;
        font-weight: 500;
      }

      .obs-value {
        color: #059669;
        font-weight: 500;
      }

      .obs-date {
        color: #6b7280;
      }

      .obs-status span {
        border-radius: 12px;
        padding: 2px 8px;
        font-weight: 500;
        font-size: 0.75rem;
        text-transform: capitalize;
      }

      .status-final {
        background-color: #d1fae5;
        color: #065f46;
      }

      .status-preliminary {
        background-color: #fef3c7;
        color: #92400e;
      }

      .status-unknown {
        background-color: #f3f4f6;
        color: #6b7280;
      }

      /* Chart styles */
      .chart-container {
        position: relative;
        width: 100%;
        min-height: 400px;
      }

      .chart-header {
        margin-bottom: 16px;
        text-align: center;
      }

      .chart-header h4 {
        margin: 0 0 4px 0;
        color: #1f2937;
        font-weight: 600;
      }

      .chart-header p {
        margin: 0;
        color: #6b7280;
        font-size: 0.875rem;
      }

      .chart-wrapper {
        position: relative;
        border-radius: 8px;
        background-color: #fafafa;
        padding: 16px;
        width: 100%;
        height: 400px;
      }

      .chart-wrapper canvas {
        width: 100% !important;
        height: 100% !important;
      }

      /* Debug styles */
      .debug-info {
        margin-top: 16px;
        border-radius: 6px;
        background-color: #f3f4f6;
        padding: 12px;
        font-size: 0.75rem;
        text-align: left;
      }

      .debug-info p {
        margin: 4px 0;
        color: #374151;
      }
    `,
  ],
})
export class ObservationsChartComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('chartCanvas') chartElement?: ElementRef<HTMLCanvasElement>;

  loading = false;
  error = '';
  observations: Observation[] = [];
  chartData: ObservationChartData = {};
  selectedCategory = 'blood-pressure';
  chart: Chart | null = null;

  private destroy$ = new Subject<void>();

  // LOINC codes for common observations
  private readonly LOINC_CATEGORIES = {
    'blood-pressure': [
      '8480-6', // Systolic blood pressure
      '8462-4', // Diastolic blood pressure
      '85354-9', // Blood pressure panel
    ],
    a1c: [
      '4548-4', // Hemoglobin A1c/Hemoglobin.total in Blood
      '17856-6', // Hemoglobin A1c/Hemoglobin.total in Blood by High performance liquid chromatography
    ],
    glucose: [
      '2339-0', // Glucose mass/volume in Blood
      '33747-0', // Glucose mass/volume in Serum or Plasma by Glucose oxidase method
    ],
    weight: [
      '29463-7', // Body weight
      '3141-9', // Body weight Measured
    ],
    height: [
      '8302-2', // Body height
      '3137-7', // Body height Measured
    ],
  };

  constructor(private fhirService: FhirClientService) {}

  ngOnInit(): void {
    console.log('ObservationsChartComponent: ngOnInit called');

    // Subscribe to context changes to reload observations when patient context is available
    this.fhirService.context$
      .pipe(
        takeUntil(this.destroy$),
        // Add distinctUntilChanged to prevent unnecessary reloads
        distinctUntilChanged((prev, curr) => {
          return (
            prev.patient?.id === curr.patient?.id &&
            prev.isOfflineMode === curr.isOfflineMode &&
            prev.authenticated === curr.authenticated
          );
        }),
      )
      .subscribe({
        next: (context) => {
          console.log('ObservationsChartComponent: Context changed', context);

          if (
            context.patient &&
            (context.authenticated || context.isOfflineMode)
          ) {
            console.log(
              'ObservationsChartComponent: Loading observations for patient',
              context.patient.id,
            );
            this.loadObservations();
          } else {
            console.log(
              'ObservationsChartComponent: No patient context available',
            );
            // No patient context available, show empty state
            this.observations = [];
            this.error = '';
            this.loading = false;
            // Clear chart if no patient
            if (this.chart) {
              this.chart.destroy();
              this.chart = null;
            }
          }
        },
        error: (error) => {
          console.error('Error subscribing to context changes:', error);
          this.error = 'Failed to load patient context';
          this.loading = false;
        },
      });
  }

  ngAfterViewInit(): void {
    if (this.observations.length > 0) {
      this.prepareChartData();
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.chart) {
      this.chart.destroy();
    }
  }

  loadObservations(): void {
    console.log('ObservationsChartComponent: loadObservations called');
    this.loading = true;
    this.error = '';

    this.fhirService.getObservations().subscribe({
      next: (observations) => {
        console.log(
          'ObservationsChartComponent: Received observations',
          observations,
        );
        console.log(
          'ObservationsChartComponent: Number of observations:',
          observations.length,
        );

        this.observations = observations;
        this.loading = false;
        this.prepareChartData();
        if (this.chartElement) {
          this.safeRenderChart();
        }
      },
      error: (error) => {
        console.error(
          'ObservationsChartComponent: Error loading observations',
          error,
        );
        this.error = error.message || 'Failed to load observations';
        this.loading = false;
        this.observations = [];
      },
    });
  }

  onCategoryChange(event: any): void {
    const newCategory = event.target?.value || event;

    // Prevent unnecessary processing if category hasn't changed
    if (this.selectedCategory === newCategory) {
      return;
    }

    this.selectedCategory = newCategory;

    // Only process if we have observations
    if (this.observations.length > 0) {
      this.prepareChartData();
      this.safeRenderChart();
    }
  }

  filterObservationsByCategory(
    observations: Observation[],
    category: string,
  ): Observation[] {
    if (category === 'all') {
      return observations;
    }

    const categoryLoincCodes =
      this.LOINC_CATEGORIES[category as keyof typeof this.LOINC_CATEGORIES];
    if (!categoryLoincCodes) {
      return [];
    }

    return observations.filter((obs) => {
      const coding = obs.code?.coding;
      if (!coding) return false;

      return coding.some(
        (code) =>
          code.system === 'http://loinc.org' &&
          categoryLoincCodes.includes(code.code || ''),
      );
    });
  }

  prepareChartData(): void {
    const filteredObservations = this.filterObservationsByCategory(
      this.observations,
      this.selectedCategory,
    );

    const grouped = this.groupObservationsByType(filteredObservations);
    const datasets: ChartDataset[] = [];
    const colors = [
      '#3b82f6', // Blue
      '#ef4444', // Red
      '#10b981', // Green
      '#f59e0b', // Yellow
      '#8b5cf6', // Purple
      '#06b6d4', // Cyan
    ];

    let colorIndex = 0;
    for (const [label, obsArray] of Object.entries(grouped)) {
      const sortedObs = this.sortObservationsByDate(obsArray);
      const data: ChartDataPoint[] = sortedObs
        .map((obs) => {
          const date = this.extractObservationDate(obs);
          const value = this.extractObservationValue(obs);
          return date && value !== null ? { x: date, y: value } : null;
        })
        .filter((point): point is ChartDataPoint => point !== null);

      if (data.length > 0) {
        const color = colors[colorIndex % colors.length] || '#3b82f6';
        datasets.push({
          label,
          data,
          borderColor: color,
          backgroundColor: color + '20',
          tension: 0.1,
        });
        colorIndex++;
      }
    }

    this.chartData = { datasets };
  }

  groupObservationsByType(observations: Observation[]): GroupedObservations {
    const grouped: GroupedObservations = {};

    observations.forEach((obs) => {
      const label = this.getObservationLabel(obs);
      if (label) {
        if (!grouped[label]) {
          grouped[label] = [];
        }
        grouped[label].push(obs);
      }
    });

    return grouped;
  }

  getObservationLabel(obs: Observation): string | null {
    if (obs.code?.text) {
      return obs.code.text;
    }
    if (obs.code?.coding && obs.code.coding.length > 0) {
      const firstCoding = obs.code.coding[0];
      return firstCoding?.display || firstCoding?.code || null;
    }
    return null;
  }

  sortObservationsByDate(observations: Observation[]): Observation[] {
    return [...observations].sort((a, b) => {
      const dateA = this.extractObservationDate(a);
      const dateB = this.extractObservationDate(b);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }

  extractObservationValue(
    obs: Observation,
    componentCode?: string,
  ): number | null {
    // If looking for a specific component (for multi-component observations)
    if (componentCode && obs.component) {
      const component = obs.component.find((comp) =>
        comp.code?.coding?.some((coding) => coding.code === componentCode),
      );
      if (component?.valueQuantity?.value !== undefined) {
        return component.valueQuantity.value;
      }
    }

    // Standard value extraction
    if (obs.valueQuantity?.value !== undefined) {
      return obs.valueQuantity.value;
    }

    return null;
  }

  extractObservationDate(obs: Observation): string | null {
    if (obs.effectiveDateTime) {
      return obs.effectiveDateTime;
    }
    if (obs.effectivePeriod?.start) {
      return obs.effectivePeriod.start;
    }
    return null;
  }

  renderChart(): void {
    if (!this.chartElement?.nativeElement) {
      return;
    }

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartElement.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'line',
      data: this.chartData as any,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM dd',
                month: 'MMM yyyy',
              },
            },
            title: {
              display: true,
              text: 'Date',
            },
          },
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Value',
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
        },
        elements: {
          point: {
            radius: 4,
            hoverRadius: 6,
          },
        },
      },
    };

    try {
      this.chart = new Chart(ctx, config);
    } catch (error) {
      console.error('Error creating chart:', error);
      this.error = 'Failed to render chart';
    }
  }

  // Add a method to safely render chart with error handling
  private safeRenderChart(): void {
    try {
      this.renderChart();
    } catch (error) {
      console.error('Error rendering chart:', error);
      this.error = 'Failed to render chart';
    }
  }

  // Getter for sorted observations
  get sortedObservations(): Observation[] {
    return this.sortObservationsByDate(this.observations);
  }

  // Track function for ngFor performance
  trackByObservation(_index: number, obs: Observation): string {
    return obs.id;
  }

  // Format observation value for display
  formatObservationValue(obs: Observation): string {
    const value = this.extractObservationValue(obs);
    if (value === null) return 'N/A';

    const unit = obs.valueQuantity?.unit || '';
    return `${value} ${unit}`.trim();
  }

  // Format observation date for display
  formatObservationDate(obs: Observation): string {
    const date = this.extractObservationDate(obs);
    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString();
  }

  // Get display name for category
  getCategoryDisplayName(category: string): string {
    const categoryNames: { [key: string]: string } = {
      'blood-pressure': 'Blood Pressure',
      a1c: 'Hemoglobin A1c',
      glucose: 'Glucose',
      weight: 'Weight',
      height: 'Height',
    };

    return categoryNames[category] || 'Unknown';
  }

  // Get filtered observations for current category
  getFilteredObservations(): Observation[] {
    return this.filterObservationsByCategory(
      this.observations,
      this.selectedCategory,
    );
  }

  // Get current context information
  getCurrentContextInfo(): string {
    const context = this.fhirService.getCurrentContext();
    if (context.patient) {
      return `Patient ID: ${context.patient.id}, Offline Mode: ${context.isOfflineMode}, Authenticated: ${context.authenticated}`;
    }
    return 'No patient context available';
  }
}
