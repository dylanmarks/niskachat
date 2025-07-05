import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
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

type GroupedObservations = Record<string, Observation[]>;

@Component({
  selector: 'app-observations-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './observations-chart.component.html',
  styles: [
    `
      .observations-chart-container {
        box-sizing: border-box;
        margin: 16px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        background: white;
        padding: 24px;
        width: 100%;
        max-width: 100%;
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
        color: #374151;
        font-weight: 500;
      }

      .category-select {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background-color: white;
        padding: 8px 12px;
        min-width: 150px;
        font-size: 14px;
      }

      .category-select:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        border-color: #3b82f6;
      }

      .back-button {
        transition: background-color 0.2s;
        cursor: pointer;
        border: none;
        border-radius: 6px;
        background-color: #6b7280;
        padding: 8px 16px;
        color: white;
        font-size: 14px;
      }

      .back-button:hover {
        background-color: #4b5563;
      }

      .observations-content {
        min-height: 300px;
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

      /* Table Styles */
      .observations-table-container {
        border-radius: 8px;
        background: #f9fafb;
        padding: 16px;
      }

      .observations-summary h4 {
        margin: 0 0 8px 0;
        color: #1f2937;
      }

      .observations-summary p {
        margin: 0 0 16px 0;
        color: #6b7280;
        font-style: italic;
      }

      .table-container {
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        border-radius: 6px;
        overflow-x: auto;
      }

      .observations-table {
        border-collapse: collapse;
        background: white;
        width: 100%;
        font-size: 14px;
      }

      .observations-table th {
        border-bottom: 1px solid #e5e7eb;
        background: #f3f4f6;
        padding: 12px;
        color: #374151;
        font-weight: 600;
        text-align: left;
      }

      .observation-row {
        transition: background-color 0.2s;
        cursor: pointer;
      }

      .observation-row:hover {
        background-color: #f9fafb;
      }

      .observation-row:active {
        background-color: #f3f4f6;
      }

      .observations-table td {
        border-bottom: 1px solid #f3f4f6;
        padding: 12px;
      }

      .obs-type.clickable {
        color: #3b82f6;
        font-weight: 500;
      }

      .obs-type.clickable:hover {
        color: #2563eb;
        text-decoration: underline;
      }

      .obs-value {
        font-weight: 500;
      }

      .obs-date {
        color: #6b7280;
      }

      .status-final {
        border-radius: 12px;
        background: #ecfdf5;
        padding: 2px 8px;
        color: #10b981;
        font-weight: 500;
        font-size: 12px;
      }

      .status-preliminary {
        border-radius: 12px;
        background: #fffbeb;
        padding: 2px 8px;
        color: #f59e0b;
        font-weight: 500;
        font-size: 12px;
      }

      .status-unknown {
        border-radius: 12px;
        background: #f3f4f6;
        padding: 2px 8px;
        color: #6b7280;
        font-weight: 500;
        font-size: 12px;
      }

      /* Chart Styles */
      .chart-container {
        border-radius: 8px;
        background: #f9fafb;
        padding: 16px;
      }

      .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .chart-header h4 {
        margin: 0;
        color: #1f2937;
      }

      .chart-header p {
        margin: 0;
        color: #6b7280;
        font-size: 14px;
      }

      .chart-wrapper {
        position: relative;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        border-radius: 6px;
        background: white;
        padding: 16px;
        height: 400px;
      }

      .no-chart-data {
        padding: 40px;
        color: #6b7280;
        text-align: center;
      }

      .no-chart-data .link-button {
        cursor: pointer;
        border: none;
        background: none;
        color: #3b82f6;
        font-size: inherit;
        text-decoration: underline;
      }

      .no-chart-data .link-button:hover {
        color: #2563eb;
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
  selectedCategory = 'all';
  chart: Chart | null = null;
  observationDisplayedColumns: string[] = [
    'type',
    'value',
    'date',
    'status',
    'actions',
  ];

  private destroy$ = new Subject<void>();

  // Use Angular's inject() for DI to avoid triggering linter warnings
  private readonly fhirService = inject(FhirClientService);
  private readonly ngZone = inject(NgZone);

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
    if (this.observations.length > 0 && this.selectedCategory !== 'all') {
      this.prepareChartData();
      // Add small delay to ensure DOM is ready
      setTimeout(() => {
        this.safeRenderChart();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Use the safer destroy method
    this.destroyChart();
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

        // Only prepare chart data if we're not in table view
        if (this.selectedCategory !== 'all') {
          this.prepareChartData();
          if (this.chartElement) {
            setTimeout(() => {
              this.safeRenderChart();
            }, 200);
          }
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
    const newCategory = event.target?.value ?? event;

    // Prevent unnecessary processing if category hasn't changed
    if (this.selectedCategory === newCategory) {
      return;
    }

    console.log(
      'Category changed from',
      this.selectedCategory,
      'to',
      newCategory,
    );
    this.selectedCategory = newCategory;

    // Clear existing chart when switching categories
    this.destroyChart();

    // Only process if we have observations and we're switching to a chart view
    if (this.observations.length > 0 && this.selectedCategory !== 'all') {
      this.renderChartForCategory();
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
    console.log('prepareChartData called');
    console.log('selectedCategory:', this.selectedCategory);
    console.log('total observations:', this.observations.length);

    const filteredObservations = this.filterObservationsByCategory(
      this.observations,
      this.selectedCategory,
    );

    console.log('filtered observations:', filteredObservations.length);

    if (filteredObservations.length === 0) {
      console.log('No observations to chart');
      this.chartData = { datasets: [] };
      return;
    }

    const grouped = this.groupObservationsByType(filteredObservations);
    console.log('grouped observations:', Object.keys(grouped));

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

          // Validate both date and value are present and valid
          if (!date || value === null || isNaN(value)) {
            return null;
          }

          // Validate date is a valid date
          const dateObj = new Date(date);
          if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date:', date);
            return null;
          }

          return { x: date, y: value };
        })
        .filter((point): point is ChartDataPoint => point !== null);

      if (data.length > 0) {
        const color = colors[colorIndex % colors.length] ?? '#3b82f6';
        datasets.push({
          label,
          data,
          borderColor: color,
          backgroundColor: color + '20',
          tension: 0.1,
        });
        colorIndex++;
        console.log(`Created dataset for ${label} with ${data.length} points`);
      } else {
        console.log(`No valid data points for ${label}`);
      }
    }

    this.chartData = { datasets };
    console.log('Final chart data prepared with', datasets.length, 'datasets');
  }

  groupObservationsByType(observations: Observation[]): GroupedObservations {
    const grouped: GroupedObservations = {};

    observations.forEach((obs) => {
      // Special handling for blood pressure panel observations (component-based)
      if (this.isBloodPressurePanel(obs)) {
        this.processBloodPressureComponents(obs, grouped);
      } else {
        // Standard observation processing
        const label = this.getObservationLabel(obs);
        if (label) {
          if (!grouped[label]) {
            grouped[label] = [];
          }
          grouped[label].push(obs);
        }
      }
    });

    return grouped;
  }

  // Check if observation is a blood pressure panel
  private isBloodPressurePanel(obs: Observation): boolean {
    return (
      obs.code?.coding?.some(
        (coding) =>
          coding.system === 'http://loinc.org' && coding.code === '85354-9',
      ) ?? false
    );
  }

  // Process blood pressure panel components into separate groups
  private processBloodPressureComponents(
    obs: Observation,
    grouped: GroupedObservations,
  ): void {
    if (!obs.component) return;

    obs.component.forEach((component) => {
      const componentCoding = component.code?.coding?.[0];
      if (!componentCoding) return;

      let label: string | null = null;

      // Map LOINC codes to readable labels
      if (componentCoding.code === '8480-6') {
        label = 'Systolic Blood Pressure';
      } else if (componentCoding.code === '8462-4') {
        label = 'Diastolic Blood Pressure';
      }

      if (label && component.valueQuantity?.value !== undefined) {
        if (!grouped[label]) {
          grouped[label] = [];
        }

        // Create a synthetic observation for the component
        const { component: _, ...baseObs } = obs;
        const componentObs: Observation = {
          ...baseObs,
          code: component.code || { coding: [] },
          valueQuantity: component.valueQuantity,
        };

        grouped[label]!.push(componentObs);
      }
    });
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

  // Sort observations by effective date (newest first)
  private sortObservationsByDate(observations: Observation[]): Observation[] {
    return observations.sort((a, b) => {
      const dateA = this.extractObservationDate(a);
      const dateB = this.extractObservationDate(b);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      // Sort in descending order (newest first)
      return new Date(dateB).getTime() - new Date(dateA).getTime();
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
    console.log('renderChart called, chartData:', this.chartData);
    console.log('datasets:', this.chartData.datasets?.length ?? 0);

    // Basic validation checks
    if (!this.chartElement?.nativeElement) {
      console.log('No chart element available');
      return;
    }

    if (!this.chartData.datasets || this.chartData.datasets.length === 0) {
      console.log('No chart data available');
      return;
    }

    // Validate that datasets have data points
    const hasValidData = this.chartData.datasets.some(
      (dataset) => dataset.data && dataset.data.length > 0,
    );

    if (!hasValidData) {
      console.log('No valid data points in datasets');
      return;
    }

    // Make sure any existing chart is destroyed
    this.destroyChart();

    const ctx = this.chartElement.nativeElement.getContext('2d');
    if (!ctx) {
      console.log('Could not get canvas context');
      return;
    }

    // Simplified chart configuration to prevent freezing
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        datasets: this.chartData.datasets.map((dataset) => ({
          label: dataset.label,
          data: dataset.data.map((point) => ({
            x: new Date(point.x).getTime(),
            y: point.y,
          })),
          borderColor: dataset.borderColor ?? '#3b82f6',
          backgroundColor: dataset.backgroundColor ?? '#3b82f620',
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
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
      },
    };

    try {
      // Render the chart outside Angular's zone to avoid triggering change detection
      this.ngZone.runOutsideAngular(() => {
        this.chart = new Chart(ctx, config);
      });
      console.log('Chart created successfully');
    } catch (error) {
      console.error('Error creating chart:', error);
      this.error = 'Failed to render chart';
      this.chart = null;
    }
  }

  // Add a method to safely render chart with error handling
  private safeRenderChart(): void {
    try {
      console.log('safeRenderChart called');

      // Double-check we have everything we need
      if (!this.chartElement?.nativeElement) {
        console.log('Chart element not available');
        return;
      }

      if (!this.chartData.datasets || this.chartData.datasets.length === 0) {
        console.log('No chart datasets available');
        this.error = 'No data available for chart';
        return;
      }

      // Check if datasets have valid data
      const totalDataPoints = this.chartData.datasets.reduce(
        (total, dataset) => total + (dataset.data?.length ?? 0),
        0,
      );

      if (totalDataPoints === 0) {
        console.log('No data points in datasets');
        this.error = 'No data points available for chart';
        return;
      }

      console.log(
        `Rendering chart with ${this.chartData.datasets.length} datasets and ${totalDataPoints} total points`,
      );
      this.renderChart();
    } catch (error) {
      console.error('Error in safeRenderChart:', error);
      this.error = 'Failed to render chart';
      this.destroyChart(); // Clean up on error
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
    // Special handling for blood pressure panels
    if (this.isBloodPressurePanel(obs)) {
      return this.formatBloodPressureValue(obs);
    }

    const value = this.extractObservationValue(obs);
    if (value === null) return 'N/A';

    const unit = obs.valueQuantity?.unit ?? '';
    return `${value} ${unit}`.trim();
  }

  // Format blood pressure panel values as "systolic/diastolic unit"
  private formatBloodPressureValue(obs: Observation): string {
    if (!obs.component) return 'N/A';

    let systolic: number | null = null;
    let diastolic: number | null = null;
    let unit = '';

    obs.component.forEach((component) => {
      const componentCoding = component.code?.coding?.[0];
      if (!componentCoding) return;

      if (componentCoding.code === '8480-6') {
        // Systolic blood pressure
        systolic = component.valueQuantity?.value ?? null;
        unit = component.valueQuantity?.unit ?? '';
      } else if (componentCoding.code === '8462-4') {
        // Diastolic blood pressure
        diastolic = component.valueQuantity?.value ?? null;
      }
    });

    if (systolic !== null && diastolic !== null) {
      return `${systolic}/${diastolic} ${unit}`.trim();
    } else if (systolic !== null) {
      return `${systolic}/- ${unit}`.trim();
    } else if (diastolic !== null) {
      return `-/${diastolic} ${unit}`.trim();
    }

    return 'N/A';
  }

  // Format observation date for display
  formatObservationDate(obs: Observation): string {
    const date = this.extractObservationDate(obs);
    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString();
  }

  // Get display name for category
  getCategoryDisplayName(category: string): string {
    const categoryNames: Record<string, string> = {
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

  // Add a method to back to table view
  backToTable(): void {
    console.log('Switching back to table view');
    this.destroyChart();
    this.selectedCategory = 'all';
    this.error = ''; // Clear any chart errors
  }

  // Add a method to handle observation click
  onObservationClick(obs: Observation): void {
    console.log('Observation clicked:', obs);
    const category = this.detectObservationCategory(obs);
    console.log('Detected category:', category);

    if (category && category !== 'all') {
      this.selectedCategory = category;
      // Only render chart if we have a valid canvas element
      this.renderChartForCategory();
    }
  }

  // Method to detect which category an observation belongs to
  private detectObservationCategory(obs: Observation): string | null {
    if (!obs.code?.coding) {
      return null;
    }

    for (const [category, loincCodes] of Object.entries(
      this.LOINC_CATEGORIES,
    )) {
      const hasMatchingCode = obs.code.coding.some(
        (coding) =>
          coding.system === 'http://loinc.org' &&
          loincCodes.includes(coding.code ?? ''),
      );

      if (hasMatchingCode) {
        return category;
      }
    }

    return null;
  }

  // Simplified chart rendering method
  private renderChartForCategory(): void {
    console.log('renderChartForCategory called for:', this.selectedCategory);

    // Clear any existing chart first
    this.destroyChart();

    // Prepare chart data
    this.prepareChartData();

    // Only render if we have data and DOM element is ready
    if (this.chartData.datasets && this.chartData.datasets.length > 0) {
      // Use shorter timeout for better responsiveness
      setTimeout(() => {
        this.safeRenderChart();
      }, 50);
    } else {
      console.log(
        'No chart data available for category:',
        this.selectedCategory,
      );
    }
  }

  // Add a dedicated method to safely destroy the chart
  private destroyChart(): void {
    if (this.chart) {
      // Destroy the chart outside Angular's zone as well
      this.ngZone.runOutsideAngular(() => {
        try {
          this.chart!.destroy();
        } catch (error) {
          console.warn('Error destroying chart:', error);
        }
      });
      this.chart = null;
    }
  }
}
