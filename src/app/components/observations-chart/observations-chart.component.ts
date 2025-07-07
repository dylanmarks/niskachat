import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, distinctUntilChanged, takeUntil } from 'rxjs';
import { FhirClientService, Observation } from '../../services/fhir-client.service';
import { ChartRendererDirective } from '../../directives/chart-renderer.directive';
import { ObservationsService, ObservationChartData } from '../../services/observations.service';

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
    ChartRendererDirective,
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
export class ObservationsChartComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  loading = false;
  error = '';
  observations: Observation[] = [];
  chartData: ObservationChartData = {};
  selectedCategory = 'all';
  observationDisplayedColumns: string[] = ['type', 'value', 'date', 'status', 'actions'];

  private destroy$ = new Subject<void>();

  constructor(
    private fhirService: FhirClientService,
    private observationsService: ObservationsService,
  ) {}

  ngOnInit(): void {
    this.fhirService.context$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) =>
          a.patient?.id === b.patient?.id && a.isOfflineMode === b.isOfflineMode && a.authenticated === b.authenticated,
        ),
      )
      .subscribe((ctx) => {
        if (ctx.patient && (ctx.authenticated || ctx.isOfflineMode)) {
          this.loadObservations();
        } else {
          this.observations = [];
          this.error = '';
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadObservations(): void {
    this.loading = true;
    this.error = '';
    this.observationsService
      .getObservations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (obs) => {
          this.observations = obs;
          this.loading = false;
          if (this.selectedCategory !== 'all') {
            this.chartData = this.observationsService.prepareChartData(this.observations, this.selectedCategory);
          }
        },
        error: (err) => {
          this.error = err.message || 'Failed to load observations';
          this.loading = false;
          this.observations = [];
        },
      });
  }

  onCategoryChange(event: any): void {
    const newCategory = event.target?.value ?? event;
    if (this.selectedCategory === newCategory) return;
    this.selectedCategory = newCategory;
    if (this.observations.length > 0 && this.selectedCategory !== 'all') {
      this.chartData = this.observationsService.prepareChartData(this.observations, this.selectedCategory);
    }
  }

  backToTable(): void {
    this.selectedCategory = 'all';
    this.error = '';
  }

  onObservationClick(obs: Observation): void {
    const category = this.observationsService.detectCategory(obs);
    if (category && category !== 'all') {
      this.selectedCategory = category;
      this.chartData = this.observationsService.prepareChartData(this.observations, this.selectedCategory);
    }
  }

  // Wrapper methods for template/tests
  filterObservationsByCategory(obs: Observation[], category: string): Observation[] {
    return this.observationsService.filterByCategory(obs, category);
  }

  prepareChartData(): void {
    this.chartData = this.observationsService.prepareChartData(this.observations, this.selectedCategory);
  }

  groupObservationsByType(obs: Observation[]) {
    return this.observationsService.groupByType(obs);
  }

  extractObservationValue(obs: Observation, componentCode?: string): number | null {
    return this.observationsService.extractObservationValue(obs, componentCode);
  }

  extractObservationDate(obs: Observation): string | null {
    return this.observationsService.extractObservationDate(obs);
  }

  get sortedObservations(): Observation[] {
    return this.observationsService.sortByDate(this.observations);
  }

  formatObservationValue(obs: Observation): string {
    return this.observationsService.formatObservationValue(obs);
  }

  formatObservationDate(obs: Observation): string {
    return this.observationsService.formatObservationDate(obs);
  }

  getCategoryDisplayName(category: string): string {
    return this.observationsService.getCategoryDisplayName(category);
  }

  getFilteredObservations(): Observation[] {
    return this.observationsService.filterByCategory(this.observations, this.selectedCategory);
  }

  getCurrentContextInfo(): string {
    const ctx = this.fhirService.getCurrentContext();
    if (ctx.patient) {
      return `Patient ID: ${ctx.patient.id}, Offline Mode: ${ctx.isOfflineMode}, Authenticated: ${ctx.authenticated}`;
    }
    return 'No patient context available';
  }
}
